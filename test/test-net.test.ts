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
import { getStaking20SystemConfig, getStaking721SystemConfig } from "../src/deploy/campaign/staking-system-config";
import { skipSeconds } from "./helpers/voting/mine";
import { Block } from "ethers";
import { calcStakeRewards } from "./helpers/staking";
import { executeTX } from "./helpers/transation-call";
import { ZModulesZeroVotingERC721DM } from "../src/deploy/missions/voting-erc721/voting721.mission";
import { ZModulesStakingERC721DM } from "../src/deploy/missions/staking-erc721/staking721.mission";


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
let mockErc20REW : MockERC20;
let mockErc721STK : MockERC721;

let rep20Token : ZeroVotingERC20;
let rep721Token : ZeroVotingERC721;

let staking20 : StakingERC20;
let staking721 : StakingERC721;

let tx;

const mintAmount = hre.ethers.parseUnits("1000");
const baseUri = "https://voting721.com/";
const emptyUri = "";

describe("Staking", () => {
  before(async () => {

    [ user1, fWallet, user2 ] = await hre.ethers.getSigners();

    const staking20Config = await getStaking20SystemConfig(user2, user1, fWallet);
    const staking721Config = await getStaking721SystemConfig(user2, user1, fWallet);

    config = {
      ...staking20Config,
      votingERC721Config: staking721Config.votingERC721Config,
      stakingERC721Config: staking721Config.stakingERC721Config,
    };

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
        ZModulesZeroVotingERC721DM,
        ZModulesStakingERC20DM,
        ZModulesStakingERC721DM,
      ],
    });

    ({
      votingErc20: rep20Token,
      votingErc721: rep721Token,
      staking20,
      staking721,
      mockErc20STK,
      mockErc20REW,
      mockErc721STK,
    } = campaign.state.contracts);

    // Mint funds to users to stake
    tx = await mockErc20STK.connect(user1).mint(user1.address, mintAmount);
    await tx.wait(Number(process.env.CONFIRMATIONS_N));

    tx = await mockErc20STK.connect(user1).mint(user2.address, mintAmount);
    await tx.wait(Number(process.env.CONFIRMATIONS_N));

    // Give staking contract balance to pay rewards
    tx = await mockErc20REW.connect(user1).mint(staking20.target, hre.ethers.parseUnits("1000000000000"));
    await tx.wait(Number(process.env.CONFIRMATIONS_N));

    // Approves for staking and rewards tokens
    tx = await mockErc20STK.connect(user1).approve(staking20.target, mintAmount * 2n);
    await tx.wait(Number(process.env.CONFIRMATIONS_N));

    tx = await mockErc20REW.connect(user1).approve(staking20.target, hre.ethers.parseUnits("1000000000000"));
    await tx.wait(Number(process.env.CONFIRMATIONS_N));

    // Mint 10 nfts to user1 with "1-10" IDs
    for (let id = 1; id < 11; id++) {
      await executeTX(
        mockErc721STK,
        mockErc721STK.connect(user1).mint(fWallet.address, id)
      );
    }

    await executeTX(
      mockErc721STK,
      mockErc721STK.connect(fWallet).setApprovalForAll(staking721.target, true)
    );
  });

  describe("Staking ERC20", () => {
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

    it("should allow a user to unstake non-locked amount partially and burns `stakeRepToken`", async () => {
      const stakeAmount = hre.ethers.parseUnits("100");
      await executeTX(
        mockErc20STK,
        mockErc20STK.connect(user2).approve(staking20.target, stakeAmount)
      );
      await executeTX(
        staking20,
        staking20.connect(user2).stakeWithoutLock(stakeAmount)
      );

      let block = await hre.ethers.provider.getBlock("latest");
      const stakedAt = BigInt((block as Block).timestamp);

      await skipSeconds(35n);

      const rewardsBalanceBefore = await mockErc20REW.balanceOf(user2.address);
      const stakeTokenBalanceBefore = await mockErc20STK.balanceOf(user2.address);
      const repTokenBalanceBefore = await rep20Token.balanceOf(user2.address);

      const unstakeAmount = stakeAmount / 2n;

      await executeTX(
        staking20,
        staking20.connect(user2).unstakeUnlocked(unstakeAmount)
      );

      block = await hre.ethers.provider.getBlock("latest");
      const unstakedAt = BigInt((block as Block).timestamp);
      const repTokenBalanceAfter = await rep20Token.balanceOf(user2.address);

      const contractConfig = await staking20.getLatestConfig();

      const stakeRewards = calcStakeRewards(
        stakeAmount,
        unstakedAt - stakedAt,
        false,
        contractConfig
      );

      const rewardsBalanceAfter = await mockErc20REW.balanceOf(user2.address);
      const stakeTokenBalanceAfter = await mockErc20STK.balanceOf(user2.address);

      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + unstakeAmount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + stakeRewards);
      expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore - unstakeAmount);
      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + unstakeAmount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + stakeRewards);

      const stakerData = await staking20.stakers(user2.address);

      expect(stakerData.amountStaked).to.eq(stakeAmount / 2n);
      expect(stakerData.lastTimestamp).to.eq(unstakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(0n); // User has no locked stake
      expect(stakerData.owedRewards).to.eq(0n);
    });
  });

  describe("Staking ERC721", () => {
    it("should stake a single NFT using #stakeWithoutLock and mint `stakeRepToken`", async () => {
      const supplyBefore = await rep721Token.totalSupply();
      const tokenId = 1n;

      const amountStaked = 1n;
      await executeTX(
        staking721,
        staking721.connect(fWallet).stakeWithoutLock([tokenId], [emptyUri])
      );

      const block = await hre.ethers.provider.getBlock("latest");
      const stakedAt = BigInt((block as Block).timestamp);

      const supplyAfter = await rep721Token.totalSupply();

      const stakerData = await staking721.connect(fWallet).nftStakers(fWallet.address);

      const tokenUri = await rep721Token.tokenURI(tokenId);
      expect(tokenUri).to.eq(baseUri + tokenId);

      // A new sNFT was created
      expect(supplyAfter).to.eq(supplyBefore + amountStaked);

      // User now has one sNFT after staking
      expect(await rep721Token.balanceOf(fWallet.address)).to.eq(1);

      expect(stakerData.amountStaked).to.eq(amountStaked);
      expect(stakerData.lastTimestamp).to.eq(stakedAt);
    });

    it("Can stake multiple NFTs using #stakeWithLock", async () => {
      const supplyBefore = await rep721Token.totalSupply();

      const amountStakedLocked = 2n;

      await executeTX(
        staking721,
        staking721.connect(fWallet).stakeWithLock(
          [10n, 9n],
          [emptyUri, emptyUri],
          60n
        )
      );

      const block = await hre.ethers.provider.getBlock("latest");
      const secondStakedAtB = BigInt((block as Block).timestamp);

      const supplyAfter = await rep721Token.totalSupply();

      const stakerData = await staking721.connect(fWallet).nftStakers(fWallet.address);

      expect(supplyAfter).to.eq(supplyBefore + 2n);
      expect(stakerData.amountStakedLocked).to.eq(amountStakedLocked);
      expect(stakerData.lastTimestampLocked).to.eq(secondStakedAtB);
    });
  });
});
