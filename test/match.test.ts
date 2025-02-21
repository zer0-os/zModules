import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Match, MockERC20, Match__factory } from "../typechain";
import { getMatchDataHash } from "./helpers/match/hashing";
import { getMatchEvents } from "./helpers/match/events";
import {
  ARRAY_MISMATCH_ERR,
  INSUFFICIENT_FUNDS_ERR,
  INVALID_MATCH_ERR, INVALID_PAYOUTS_ERR,
  MATCH_STARTED_ERR,
  NO_PLAYERS_ERR, NOT_AUTHORIZED_ERR,
  OWNABLE_UNAUTHORIZED_ERR, ZERO_ADDRESS_ERR, ZERO_MATCH_FEE_ERR,
} from "./helpers/errors";
import { getPayouts } from "./helpers/match/payouts";
import {
  IMatchConfig,
  contractNames,
  runZModulesCampaign,
} from "../src/deploy";
import { MongoDBAdapter } from "@zero-tech/zdc";
import { acquireLatestGitTag } from "../src/utils/git-tag/save-tag";
import { getMockERC20Mission, TokenTypes } from "../src/deploy/missions/mocks/mockERC20.mission";
import { ZModulesMatchDM } from "../src/deploy/missions/match/match.mission";
import { getMatchDeployConfig } from "../src/deploy/missions/match/match.config";
import { getBaseZModulesConfig } from "../src/deploy/campaign/get-campaign-config";

const getPlayerBalances = async (
  players : Array<string>,
  contract : Match
) => players.reduce(
  async (acc : Promise<Array<bigint>>, playerAddr) => {
    const newAcc = await acc;
    const bal = await contract.balances(playerAddr);
    return [...newAcc, bal];
  }, Promise.resolve([])
);


describe("Match Contract",  () => {
  let mockERC20 : MockERC20;
  let match : Match;

  let owner : SignerWithAddress;
  let player1 : SignerWithAddress;
  let player2 : SignerWithAddress;
  let player3 : SignerWithAddress;
  let player4 : SignerWithAddress;
  let player5 : SignerWithAddress;
  let player6 : SignerWithAddress;
  let operator1 : SignerWithAddress;
  let operator2 : SignerWithAddress;
  let operator3 : SignerWithAddress;
  let feeVault : SignerWithAddress;
  let allPlayers : Array<SignerWithAddress>;

  let MatchFactory : Match__factory;

  let dbAdapter : MongoDBAdapter;

  let config : IMatchConfig;

  let tokenForMatch : MockERC20;

  const matchFee = ethers.parseEther("3.29");
  const gameFeePercInitial = 1000n; // 10%
  const gameFeePerc = 500n; // 5%

  const mockTokens = process.env.MOCK_TOKENS === "true";

  before(async () => {
    [
      owner,
      player1,
      player2,
      player3,
      player4,
      player5,
      player6,
      operator1,
      operator2,
      operator3,
      feeVault,
    ] = await hre.ethers.getSigners();

    allPlayers = [
      player1,
      player2,
      player3,
      player4,
      player5,
      player6,
    ];

    const baseConfig = await getBaseZModulesConfig({
      deployAdmin: owner,
    });

    const argsForDeployMatch = {
      feeVault: feeVault.address,
      owner: owner.address,
      operators: [
        operator1.address,
        operator2.address,
        operator3.address,
      ],
      gameFeePercentage: gameFeePercInitial,
    };

    const campaignConfig = {
      ...baseConfig,
      matchConfig: await getMatchDeployConfig({
        mockTokens,
        config: argsForDeployMatch,
      }),
    };

    const campaign = await runZModulesCampaign({
      config: campaignConfig,
      missions: [
        getMockERC20Mission({
          tokenType: TokenTypes.general,
        }),
        ZModulesMatchDM,
      ],
    });

    ({
      dbAdapter,
      match,
      [`${contractNames.mocks.erc20.instance}${TokenTypes.general}`]: mockERC20,
    } = campaign);

    MatchFactory = await hre.ethers.getContractFactory("Match");

    config = {
      ...campaignConfig.matchConfig,
      token: await mockERC20.getAddress(),
    };

    await allPlayers.reduce(
      async (acc, player) => {
        await acc;
        await mockERC20.mint(player.address, ethers.parseEther("1000"));
        await mockERC20.connect(player).approve(match.target, ethers.parseEther("1000"));
      }, Promise.resolve()
    );
  });

  after(async () => {
    await dbAdapter.dropDB();
  });

  it("Should #setGameFeePercentage() correctly", async () => {
    const curGameFeePerc = await match.gameFeePercentage();
    expect(curGameFeePerc).to.equal(gameFeePercInitial);
    expect(curGameFeePerc).to.not.equal(gameFeePerc);

    await match.connect(owner).setGameFeePercentage(gameFeePerc);

    expect(await match.gameFeePercentage()).to.equal(gameFeePerc);
  });

  it("Should NOT allow operator to call #setGameFeePercentage()", async () => {
    await expect(
      match.connect(operator3).setGameFeePercentage(gameFeePerc)
    ).to.be.revertedWithCustomError(match, OWNABLE_UNAUTHORIZED_ERR);
  });

  it("Should revert if feeVault is passed as 0x0 address", async () => {
    await expect(
      MatchFactory.connect(owner).deploy(
        mockERC20.target,
        ethers.ZeroAddress,
        owner.address,
        [ operator3.address ],
        gameFeePercInitial
      )
    ).to.be.revertedWithCustomError(match, ZERO_ADDRESS_ERR);
  });

  describe("Aux Operations", () => {
    it("#setFeeVault should set the address correctly and emit an event", async () => {
      expect(await match.feeVault()).to.equal(feeVault.address);

      await expect(
        match.connect(owner).setFeeVault(operator1.address)
      ).to.emit(match, "FeeVaultSet")
        .withArgs(operator1.address);

      expect(await match.feeVault()).to.equal(operator1.address);

      // set back
      await match.connect(owner).setFeeVault(feeVault.address);

      expect(await match.feeVault()).to.equal(feeVault.address);
    });

    it("#setFeeVault() should revert if called by non-owner", async () => {
      await expect(
        match.connect(player1).setFeeVault(operator1.address)
      ).to.be.revertedWithCustomError(match, NOT_AUTHORIZED_ERR);
    });

    it("#setFeeVault() should revert if 0x0 address is passed", async () => {
      await expect(
        match.connect(owner).setFeeVault(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(match, ZERO_ADDRESS_ERR);
    });
  });

  describe("Matches", () => {
    let balancesBeforeStart : Array<bigint>;
    let balancesAfterStart : Array<bigint>;
    let balancesAfterEnd : Array<bigint>;
    let playerAddresses : Array<string>;
    let matchId : bigint;
    let feeVaultBalanceBefore : bigint;
    let matchDataHash : string;

    let payouts : Array<bigint>;
    let gameFee : bigint;

    describe("#startMatch()", () => {
      it("Should revert if called by a non-owner/non-operator", async () => {
        await expect(
          match.connect(player1).startMatch(
            1,
            [player1.address, player2.address],
            ethers.parseEther("1")
          )
        ).to.be.revertedWithCustomError(match, NOT_AUTHORIZED_ERR)
          .withArgs(player1.address);
      });

      it("Should fail if any player is not funded", async () => {
        // Assuming addr1 and addr2 have insufficient balance
        const players = [player1.address, player2.address];
        const matchFeeNew = ethers.parseEther("10000000000000000000000000");
        await expect(match.startMatch(7, players, matchFeeNew))
          .to.be.revertedWithCustomError(match, INSUFFICIENT_FUNDS_ERR);
      });

      it("Should not start a match with an empty players array", async () => {
        const matchFeeNew = ethers.parseUnits("1", "wei"); // Smallest possible entry fee
        await expect(match.startMatch(9, [], matchFeeNew))
          .to.be.revertedWithCustomError(match, NO_PLAYERS_ERR);
      });

      it("Should start match for all funded players and emit MatchStarted event with correct parameters", async () => {
        matchId = 18236n;

        playerAddresses = await allPlayers.reduce(
          async (acc : Promise<Array<string>>, player) => {
            await acc;
            await match.connect(player).deposit(ethers.parseEther("10"));

            return [...(await acc), player.address];
          }, Promise.resolve([])
        );

        balancesBeforeStart = await getPlayerBalances(playerAddresses, match);

        matchDataHash = getMatchDataHash({
          matchId,
          matchFee,
          players: playerAddresses,
        });

        await match.startMatch(matchId, playerAddresses, matchFee);

        const [{
          args: {
            matchDataHash: emittedMatchDataHash,
            matchId: emittedMatchId,
            players: emittedPlayers,
            matchFee: emittedmatchFee,
            fundsLocked: emittedFundsLocked,
          },
        }] = await getMatchEvents({ match });

        expect(emittedMatchDataHash).to.equal(matchDataHash);
        expect(emittedMatchId).to.equal(matchId);
        expect(emittedPlayers.hash).to.equal(
          ethers.solidityPackedKeccak256(["address[]"], [playerAddresses])
        );
        expect(emittedmatchFee).to.equal(matchFee);
        expect(emittedFundsLocked).to.equal(matchFee * BigInt(playerAddresses.length));

        balancesAfterStart = await getPlayerBalances(playerAddresses, match);

        // calculate reference values for the subsequent tests
        ({
          payouts,
          gameFee,
        } = getPayouts({
          playerCount: BigInt(allPlayers.length),
          matchFee,
          gameFeePerc,
        }));
      });

      it("Should exempt the entry fee from all the player balances", async () => {
        balancesBeforeStart.forEach((bal, index) => {
          expect(bal - balancesAfterStart[index]).to.equal(matchFee);
        });
      });

      it("Should save and lock the correct amount of fees for the match", async () => {
        const lockedForMatch = await match.lockedFunds(matchDataHash);
        expect(lockedForMatch).to.equal(matchFee * BigInt(playerAddresses.length));
      });

      it("Should fail if the match already exists", async () => {
        await expect(match.startMatch(matchId, playerAddresses, matchFee))
          .to.be.revertedWithCustomError(match, MATCH_STARTED_ERR);
      });

      it("Should fail when starting a match with 0 `matchFee`", async () => {
        await expect(match.startMatch(2, playerAddresses, 0n))
          .to.be.revertedWithCustomError(match, ZERO_MATCH_FEE_ERR)
          .withArgs(2);
      });
    });

    describe("#endMatch()", () => {
      it("Should revert if called by a non-owner/non-operator", async () => {
        await expect(
          match.connect(player1).endMatch(
            1,
            [player1.address, player2.address],
            [ethers.parseEther("1"), ethers.parseEther("1")],
            ethers.parseEther("1"),
          )
        ).to.be.revertedWithCustomError(match, NOT_AUTHORIZED_ERR)
          .withArgs(player1.address);
      });

      it("Should fail if the match does not exist", async () => {
        const invalidMatchId = 999; // Use an ID for a match that doesn't exist
        await expect(
          match.endMatch(
            invalidMatchId,
            [player1.address, player2.address],
            [1n, 1n],
            ethers.parseEther("1")
          )
        ).to.be.revertedWithCustomError(match, INVALID_MATCH_ERR)
          .withArgs(invalidMatchId, getMatchDataHash({
            matchId: BigInt(invalidMatchId),
            matchFee: ethers.parseEther("1"),
            players: [player1.address, player2.address],
          }));
      });

      it("Should fail if players and payouts array lengths mismatch", async () => {
        await expect(
          match.endMatch(
            matchId,
            [player1.address, player2.address],
            [1n],
            ethers.parseEther("1")
          )
        ).to.be.revertedWithCustomError(match, ARRAY_MISMATCH_ERR);
      });

      it("Should revert if payout amounts are calculated incorrectly", async () => {
        const invalidPayouts = [1n, 1n, 1n, 1n, 1n, 1n];
        await expect(
          match.endMatch(
            matchId,
            playerAddresses,
            invalidPayouts,
            matchFee
          )
        ).to.be.revertedWithCustomError(match, INVALID_PAYOUTS_ERR)
          .withArgs(matchId);
      });

      it("Should end the match and emit event with correct parameters", async () => {
        const totalPayoutRef = matchFee * BigInt(playerAddresses.length);

        const totalPayout = payouts.reduce(
          (acc, payout) => acc + payout,
          0n
        );

        // make sure our helper calculated properly and there is no leftover,
        // because if we get any leftover the contract will revert
        expect(totalPayout + gameFee).to.equal(totalPayoutRef);

        feeVaultBalanceBefore = await match.balances(feeVault.address);

        await match.endMatch(
          matchId,
          playerAddresses,
          payouts,
          matchFee
        );

        const [{
          args: {
            matchDataHash: emittedMatchDataHash,
            matchId: emittedMatchId,
            players: emittedPlayers,
            payouts: emittedPayouts,
            matchFee: emittedMatchFee,
            gameFee: emittedGameFee,
          },
        }] = await getMatchEvents({
          match,
          eventName: "MatchEnded",
        });

        expect(emittedPlayers.hash).to.equal(
          ethers.solidityPackedKeccak256(["address[]"], [playerAddresses])
        );
        expect(emittedMatchDataHash).to.equal(matchDataHash);
        expect(emittedMatchId).to.equal(matchId);
        expect(emittedPayouts).to.deep.equal(payouts);
        expect(emittedMatchFee).to.equal(matchFee);
        expect(emittedGameFee).to.equal(gameFee);
      });

      it("Should remove the locked amount from the #lockedFunds mapping", async () => {
        const lockedForMatch = await match.lockedFunds(matchDataHash);
        expect(lockedForMatch).to.equal(0n);
      });

      it("Should disperse the payouts correctly to the player #balances", async () => {
        balancesAfterEnd = await getPlayerBalances(playerAddresses, match);

        playerAddresses.forEach(
          (playerAddr, index) => {
            const balBefore = balancesAfterStart[index];
            const balAfter = balancesAfterEnd[index];
            const payout = payouts[index];

            expect(balAfter - balBefore).to.equal(payout);
          }
        );
      });

      it("Should add #gameFee to the #feeVault balance", async () => {
        const feeVaultBalAfter = await match.balances(feeVault.address);

        expect(feeVaultBalAfter - feeVaultBalanceBefore).to.equal(gameFee);
      });

      it("Players should be able to withdraw their winnings", async () => {
        await allPlayers.reduce(
          async (acc, player, idx) => {
            await acc;
            await match.connect(player).withdraw(payouts[idx]);
          }, Promise.resolve()
        );

        const balancesAfterWithdraw = await getPlayerBalances(playerAddresses, match);

        balancesAfterWithdraw.forEach(
          (bal, index) => {
            expect(bal).to.equal(balancesAfterStart[index]);
          }
        );
      });
    });
  });

  describe("Access Control", () => {
    it("owner, operators assigned at deploy and operators assigned later should have appropriate rights", async () => {
      const operators = [
        owner,
        operator1,
        operator2,
        operator3, // this was assigned at construction. they all should work equally
      ];
      const depositAmt = ethers.parseEther(operators.length.toString());

      await match.connect(player1).deposit(depositAmt);
      await match.connect(player2).deposit(depositAmt);
      await match.connect(player3).deposit(depositAmt);
      await match.connect(player4).deposit(depositAmt);

      const matchFeeAC = ethers.parseEther("1");

      const players = [
        player1.address,
        player2.address,
        player3.address,
        player4.address,
      ];

      await operators.reduce(
        async (acc, operator, idx) => {
          await acc;

          await expect(
            match.connect(operator).startMatch(
              idx + 1,
              players,
              matchFeeAC
            )
          ).to.be.fulfilled;

          const {
            payouts: payoutsAC,
          } = getPayouts({
            playerCount: BigInt(players.length),
            matchFee: matchFeeAC,
            gameFeePerc,
          });

          await expect(
            match.connect(operator).endMatch(
              idx + 1,
              players,
              payoutsAC,
              matchFeeAC
            )
          ).to.be.fulfilled;

          await expect(
            match.connect(operator).setFeeVault(operator1.address)
          ).to.be.fulfilled;

          if (operator !== owner) {
            await expect(
              match.connect(operator).transferOwnership(operator1.address)
            ).to.be.revertedWithCustomError(match, OWNABLE_UNAUTHORIZED_ERR)
              .withArgs(operator.address);
          } else {
            await expect(
              match.connect(operator).transferOwnership(player1.address)
            ).to.be.fulfilled;
          }
        }, Promise.resolve()
      );

      // set back
      await match.connect(operator2).setFeeVault(feeVault.address);
      await match.connect(player1).transferOwnership(owner.address);
    });
  });

  describe("Deploy", () => {
    it("Deployed contract should exist in the DB", async () => {
      const nameOfContract = contractNames.match.contract;
      const addressOfContract = await match.getAddress();
      const contractFromDB = await dbAdapter.getContract(nameOfContract);
      const matchArtifact = await hre.artifacts.readArtifact(contractNames.match.contract);

      expect({
        addrs: contractFromDB?.address,
        label: contractFromDB?.name,
        abi: JSON.stringify(matchArtifact.abi),
      }).to.deep.equal({
        addrs: addressOfContract,
        label: nameOfContract,
        abi: contractFromDB?.abi,
      });
    });

    it("Should be deployed with correct args", async () => {
      const expectedArgs = {
        token: await match.token(),
        feeVault: await match.feeVault(),
        owner: await match.owner(),
      };

      expect(expectedArgs.token).to.eq(mockERC20.target);
      expect(expectedArgs.feeVault).to.eq(config.feeVault);
      expect(expectedArgs.owner).to.eq(config.owner);

      for (const operator of config.operators) {
        await match.isOperator(operator);
      }
    });

    it("Should have correct db and contract versions", async () => {
      const tag = await acquireLatestGitTag();
      const contractFromDB = await dbAdapter.getContract(contractNames.match.contract);
      const dbDeployedV = await dbAdapter.versioner.getDeployedVersion();

      expect({
        dbVersion: contractFromDB?.version,
        contractVersion: dbDeployedV?.contractsVersion,
      }).to.deep.equal({
        dbVersion: dbDeployedV?.dbVersion,
        contractVersion: tag,
      });
    });
  });

  describe("Separate tokens", () => {
    let match2 : Match;
    before(async () => {
      await dbAdapter.dropDB();

      [
        owner,
        operator1,
        operator2,
        operator3,
        feeVault,
      ] = await hre.ethers.getSigners();

      const tokenForMatchFactory = await hre.ethers.getContractFactory("MockERC20");
      tokenForMatch = await tokenForMatchFactory.deploy("Meow", "MEOW");

      const baseConfig = await getBaseZModulesConfig({
        deployAdmin: owner,
      });

      const argsForDeployMatch = {
        token: await tokenForMatch.getAddress(),
        feeVault: feeVault.address,
        owner: owner.address,
        operators: [
          operator1.address,
          operator2.address,
          operator3.address,
        ],
        gameFeePercentage: gameFeePercInitial,
      };

      const campaignConfig = {
        ...baseConfig,
        matchConfig: await getMatchDeployConfig({
          mockTokens,
          config: argsForDeployMatch,
        }),
      };

      const campaign = await runZModulesCampaign({
        config: campaignConfig,
        missions: [
          ZModulesMatchDM,
        ],
      });

      ({
        match: match2,
        dbAdapter,
      } = campaign);
    });

    after(async () => {
      await dbAdapter.dropDB();
    });

    it("Should deploy contract with mock, provided separetely from campaign", async () => {
      expect(await match2.token()).to.eq(await tokenForMatch.getAddress());
    });
  });
});
