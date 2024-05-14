import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Match, ERC20TestToken } from "../typechain";
import { getMatchDataHash } from "./helpers/match/hashing";
import { getMatchStartedEvents } from "./helpers/match/events";
import {
  ARRAY_MISMATCH_ERR,
  INSUFFICIENT_FUNDS_ERR,
  INVALID_MATCH_ERR,
  MATCH_STARTED_ERR,
  NO_PLAYERS_ERR,
  ONLY_OWNER_ERR,
} from "./helpers/staking";


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
  let mockERC20 : ERC20TestToken;
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
  let wilderWallet : SignerWithAddress;
  let allPlayers : Array<SignerWithAddress>;

  let ownerAddress : string;
  let mockERC20Address : string;
  let matchAddress : string;

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
      wilderWallet,
    ] = await hre.ethers.getSigners();
    ownerAddress = await owner.getAddress();

    allPlayers = [
      player1,
      player2,
      player3,
      player4,
      player5,
      player6,
    ];

    const MockERC20Factory = await hre.ethers.getContractFactory("ERC20TestToken");
    mockERC20 = (await MockERC20Factory.deploy("MockToken", "MTK")) as ERC20TestToken;
    mockERC20Address = await mockERC20.getAddress();

    const MatchFactory = await hre.ethers.getContractFactory("Match");
    match = await MatchFactory.connect(owner).deploy(
      mockERC20Address,
      ownerAddress,
      wilderWallet,
      [ operator3.address ]
    );
    matchAddress = await match.getAddress();

    await allPlayers.reduce(
      async (acc, player) => {
        await acc;
        await mockERC20.mint(player.address, ethers.parseEther("1000"));
        await mockERC20.connect(player).increaseAllowance(matchAddress, ethers.parseEther("1000"));
      }, Promise.resolve()
    );
  });

  describe("Aux Operations", () => {
    it("#canMatch() should correctly return players with missing funds", async () => {
      const depositAmount = ethers.parseEther("11");
      const feeAmt = ethers.parseEther("2.75");

      await [
        player1,
        player2,
        player4,
      ].reduce(
        async (acc, player) => {
          await acc;
          await match.connect(player).deposit(depositAmount);
        }, Promise.resolve()
      );

      const unfundedPlayers = await match.canMatch(allPlayers, feeAmt);

      expect(unfundedPlayers).to.deep.equal([
        player3.address,
        player5.address,
        player6.address,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
      ]);
    });
  });

  describe.only("Matches", () => {
    let balancesBefore : Array<bigint>;
    let balancesAfter : Array<bigint>;
    let playerAddresses : Array<string>;
    let matchId : bigint;

    const matchFee = ethers.parseEther("3.29");
    const gameFee = ethers.parseEther("0.1");
    let matchDataHash : string;

    describe("#startMatch()", () => {
      it("Should fail if any player is not funded", async () => {
        // Assuming addr1 and addr2 have insufficient balance
        const players = [player1.address, player2.address];
        const matchFee = ethers.parseEther("10000000000000000000000000");
        await expect(match.startMatch(7, players, matchFee))
          .to.be.revertedWithCustomError(match, INSUFFICIENT_FUNDS_ERR);
      });

      it("Should not start a match with an empty players array", async () => {
        const matchFee = ethers.parseUnits("1", "wei"); // Smallest possible entry fee
        await expect(match.startMatch(9, [], matchFee))
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

        balancesBefore = await getPlayerBalances(playerAddresses, match);

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
        }] = await getMatchStartedEvents({ match });

        expect(emittedMatchDataHash).to.equal(matchDataHash);
        expect(emittedMatchId).to.equal(matchId);
        expect(emittedPlayers.hash).to.equal(
          ethers.solidityPackedKeccak256(["address[]"], [playerAddresses])
        );
        expect(emittedmatchFee).to.equal(matchFee);
        expect(emittedFundsLocked).to.equal(matchFee * BigInt(playerAddresses.length));

        balancesAfter = await getPlayerBalances(playerAddresses, match);
      });

      it("Should exempt the entry fee from all the player balances", async () => {
        balancesBefore.forEach((bal, index) => {
          expect(bal - balancesAfter[index]).to.equal(matchFee);
        });
      });

      it("Should save and lock the correct amount of fees for the match", async () => {
        const lockedForMatch = await match.fundLocks(matchDataHash);
        expect(lockedForMatch).to.equal(matchFee * BigInt(playerAddresses.length));
      });

      it("Should fail if the match already exists", async () => {
        await expect(match.startMatch(matchId, playerAddresses, matchFee))
          .to.be.revertedWithCustomError(match, MATCH_STARTED_ERR);
      });
    });

    describe("#endMatch()", () => {
      it("Should fail if the match does not exist", async () => {
        const invalidMatchId = 999; // Use an ID for a match that doesn't exist
        await expect(
          match.endMatch(
            invalidMatchId,
            [player1.address, player2.address],
            [1n, 1n],
            ethers.parseEther("1"),
            ethers.parseEther("0.1")
          )
        ).to.be.revertedWithCustomError(match, INVALID_MATCH_ERR);
      });

      it("Should fail if winners and winAmounts array lengths mismatch", async () => {
        await expect(
          match.endMatch(
            matchId,
            [player1.address, player2.address],
            [1n],
            ethers.parseEther("1"),
            ethers.parseEther("0.1")
          )
        ).to.be.revertedWithCustomError(match, ARRAY_MISMATCH_ERR);
      });

      it("Should end the match and emit event with correct parameters", async () => {
        const totalPayout = matchFee * BigInt(playerAddresses.length);

        // TODO esc: figure out a proper function to calc these payouts without rounding problems !!!!
        const payout1st = totalPayout / 3n;
        const payout2nd = totalPayout / 4n;
        const payout3rd = totalPayout / 5n;
        const payoutRest = (totalPayout - (payout1st + payout2nd + payout3rd)) / (BigInt(playerAddresses.length) - 3n);
        const payouts = [
          payout1st,
          payout2nd, // 113,998,499,999,999,999,993
          payout3rd, // 19,740,000,000,000,000,000
          payoutRest,
          payoutRest,
          payoutRest,
        ];

        const totalPayoutRef = payouts.reduce(
          (sum, payout) : bigint => {
            sum += payout;
            return sum;
          }, 0n
        );

        expect(totalPayoutRef + gameFee).to.equal(totalPayout);

        await match.endMatch(
          matchId,
          playerAddresses,
          payouts,
          matchFee,
          gameFee
        );

        // TODO esc: add event test !!
      });
    });
  });

  describe("End Match", () => {
    const matchId = 0;
    it("Should fail if the match does not exist", async () => {
      const invalidMatchId = 999; // Use an ID for a match that doesn't exist
      await expect(match.endMatch(invalidMatchId, [player1.address], [ethers.parseEther("1")]))
        .to.be.revertedWith("Match does not exist");
    });

    it("Should fail if winners and winAmounts array lengths mismatch", async () => {
      await expect(match.endMatch(matchId, [player1.address], [ethers.parseEther("1"), ethers.parseEther("2")]))
        .to.be.revertedWith("Array lengths mismatch");
    });

    it("Should correctly end the match and pay winners", async () => {
      const winners = [player1.address, player2.address];
      const winAmounts = [ethers.parseEther("1"), ethers.parseEther("2")];

      // Balances before ending the match
      const initialBalances = await Promise.all(winners.map(async winner => await match.balance(winner)));

      // End the match
      const tx = await match.endMatch(matchId, winners, winAmounts);
      await tx.wait();

      // Validate winners' balances increased by winAmounts
      await Promise.all(winners.map(async (winner, index) => {
        const finalBalance = await match.balance(winner);
        const expectedBalance = initialBalances[index] + winAmounts[index];
        expect(finalBalance).to.equal(expectedBalance);
      }));
    });
  });

  describe("Access Control", () => {
    it("owner, operators assigned at deploy and operators assigned later should have appropriate rights", async () => {
      await match.connect(owner).addOperators([operator1.address, operator2.address]);

      await match.connect(player1).deposit(ethers.parseEther("1"));
      await match.connect(player2).deposit(ethers.parseEther("1"));

      await [
        owner,
        operator1,
        operator2,
        operator3, // this was assigned at construction. they all should work equally
      ].reduce(
        async (acc, operator) => {
          await acc;

          await expect(
            match.connect(operator).startMatch(
              1,
              [player1.address, player2.address],
              ethers.parseEther("1")
            )
          ).to.be.fulfilled;

          // await expect(
          await match.connect(operator).endMatch(
            1,
            [player1.address, player2.address],
            [ethers.parseEther("0.45"), ethers.parseEther("0.45")],
            ethers.parseEther("1"),
            ethers.parseEther("0.1")
          );
          // ).to.be.fulfilled;

          await expect(
            match.connect(operator).setWilderWallet(operator1.address)
          ).to.be.fulfilled;

          if (operator !== owner) {
            await expect(
              match.connect(operator).transferOwnership(operator1.address)
            ).to.be.revertedWith(ONLY_OWNER_ERR);
          } else {
            await expect(
              match.connect(operator).transferOwnership(operator1.address)
            ).to.be.fulfilled;
          }
        }, Promise.resolve()
      );

      // set back
      await match.connect(operator2).setWilderWallet(wilderWallet.address);
      await match.connect(operator1).transferOwnership(owner.address);
    });
  });
});