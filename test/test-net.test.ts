import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as hre from "hardhat";
import {
  MockERC20,
  MockERC721,
  StakingERC20,
  StakingERC721,
  ZeroVotingERC20,
  ZeroVotingERC721,
} from "../typechain";
import {
  IZModulesConfig,
  IZModulesContracts,
  runZModulesCampaign,
} from "../src/deploy";
import { DeployCampaign } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DEFAULT_STAKED_AMOUNT } from "./helpers/constants";
import { expect } from "chai";
import {
  getMockERC20Mission,
  TokenTypes,
} from "../src/deploy/missions/mocks/mockERC20.mission";
import { ZModulesStakingERC20DM } from "../src/deploy/missions/staking-erc20/staking20.mission";
import { ZModulesZeroVotingERC20DM } from "../src/deploy/missions/voting-erc20/voting20.mission";
import { getMockERC721Mission } from "../src/deploy/missions/mocks/mockERC721.mission";
import { getStaking20SystemConfig } from "../src/deploy/campaign/staking-system-config";


let user1 : SignerWithAddress;
let fWallet : SignerWithAddress;
let user2 : SignerWithAddress;

let config : IZModulesConfig;
let campaign : DeployCampaign<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts>;

let mockErc20STK : MockERC20;
let mockErc20RWD : MockERC20;
let mockErc721STK : MockERC721;

let rep20Token : ZeroVotingERC20;
let rep721Token : ZeroVotingERC721;

let staking20 : StakingERC20;
let staking721 : StakingERC721;

let tx;


describe("Staking ERC20", () => {
  before(async () => {
    const mintAmount = hre.ethers.parseUnits("1000");

    [ user1, fWallet, user2 ] = await hre.ethers.getSigners();

    config = await getStaking20SystemConfig(user2, user1, fWallet);

    campaign = await runZModulesCampaign({
      config,
      missions: [
        getMockERC20Mission({
          tokenType: TokenTypes.staking,
          tokenName: "Staking Token",
          tokenSymbol: "STK",
        }),
        getMockERC20Mission({
          tokenType: TokenTypes.rewards,
          tokenName: "Rewards Token",
          tokenSymbol: "RWD",
        }),
        getMockERC721Mission({
          tokenType: TokenTypes.staking,
          tokenName: "Staking Token",
          tokenSymbol: "STK",
          baseUri: "0://NFT/",
        }),
        ZModulesZeroVotingERC20DM,
        ZModulesStakingERC20DM,
      ],
    });

    ({
      votingErc20: rep20Token,
      votingErc721: rep721Token,
      staking20,
      staking721,
      mockErc20STK,
      mockErc20RWD,
      mockErc721STK,
    } = campaign.state.contracts);

    tx = await mockErc20STK.connect(user1).mint(user1.address, mintAmount);
    await tx.wait(Number(process.env.CONFIRMATIONS_N));
    tx = await mockErc20STK.connect(user1).approve(staking20.target, mintAmount);
    await tx.wait(Number(process.env.CONFIRMATIONS_N));
  });

  it("should stake without a lock successfully and mint proper amount of `stakeRepToken`", async () => {
    const stakeBalanceBefore = await mockErc20STK.balanceOf(user1.address);
    const repTokenBalanceBefore = await rep20Token.balanceOf(user1.address);

    tx = await staking20.connect(user1).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
    await tx.wait(Number(process.env.CONFIRMATIONS_N));

    const repTokenBalanceAfter = await rep20Token.balanceOf(user1.address);
    const stakeBalanceAfter = await mockErc20STK.balanceOf(user1.address);
    const stakerData = await staking20.stakers(user1.address);

    expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
    expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore + DEFAULT_STAKED_AMOUNT);
    expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
    expect(stakerData.amountStakedLocked).to.eq(0n);
    expect(stakerData.unlockedTimestamp).to.eq(0n);
    expect(stakerData.owedRewards).to.eq(0n);
  });
});

