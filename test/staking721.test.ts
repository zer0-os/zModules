import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20,
  MockERC721,
  StakingERC721,
} from "../typechain";
import {
  createDefaultConfigs,
  calcTotalRewards,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  BaseConfig,
  WITHDRAW_EVENT,
} from "./helpers/staking";
import {
  FAILED_INNER_CALL_ERR,
  FUNCTION_SELECTOR_ERR,
  ZERO_INIT_ERR,
  NON_TRANSFERRABLE_ERR,
  INCORRECT_OWNER_TRANSFER_ERR,
  INVALID_OWNER_ERR,
  NONEXISTENT_TOKEN_ERR,
  NO_REWARDS_ERR,
  ONLY_NFT_OWNER_ERR,
  TIME_LOCK_NOT_PASSED_ERR,
  BaseConfig,
  FUNCTION_SELECTOR_ERR,
  ZERO_INIT_ERR, NOT_OWNER_ERR,
  NON_TRANSFERRABLE_ERR,
  WITHDRAW_EVENT,
  LOW_LEVEL_CALL_ERR,
} from "./helpers/staking";
import { DCConfig, IERC20DeployArgs, IERC721DeployArgs, contractNames, runCampaign } from "../src/deploy";
import { ZModulesStakingERC721DM } from "../src/deploy/missions";
import { MongoDBAdapter } from "@zero-tech/zdc";
import { acquireLatestGitTag } from "../src/utils/git-tag/save-tag";
import { INSUFFICIENT_APPROVAL_721_ERR, OWNABLE_UNAUTHORIZED_ERR } from "./helpers/errors";

describe("StakingERC721", () => {
  let deployer : SignerWithAddress;
  let owner : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let stakingContractERC721 : StakingERC721;

  let rewardToken : MockERC20;
  let stakingToken : MockERC721;

  // We don't use `PoolConfig` anymore on the contracts but for convenience in testing
  // we can leave this type where it is
  let config : BaseConfig;

  let stakedAtA : bigint;
  let stakedAtB : bigint;

  let claimedAt : bigint;
  let unstakedAt : bigint;
  let secondUnstakedAt : bigint;

  let balanceAtStakeOne : bigint;
  let balanceAtStakeTwo : bigint;

  let durationOne : bigint;
  let durationTwo : bigint;

  // Default token ids
  const tokenIdA = 1;
  const tokenIdB = 2;
  const tokenIdC = 3;
  const tokenIdX = 100;
  const tokenIdDelayed = 7; // Minted and used in stake at a later point in time
  const nonStakedTokenId = 8; // Minted but never used in `stake`
  const unmintedTokenId = 9; // Never minted

  const baseUri = "0://staked-wheels/";
  const emptyUri = "";

  let dbAdapter : MongoDBAdapter;

  before(async () => {
    [
      deployer,
      owner,
      stakerA,
      stakerB,
      stakerC,
      notStaker,
    ] = await hre.ethers.getSigners();

    const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");

    rewardToken = await mockERC20Factory.deploy("MEOW", "MEOW");
    stakingToken = await mockERC721Factory.deploy("WilderWheels", "WW", baseUri);

    config = await createDefaultConfigs(rewardToken, stakingToken);

    const argsForDeployERC721 : IERC721DeployArgs = {
      stakingToken : config.stakingToken,
      name : "StakingNFT",
      symbol : "SNFT",
      baseUri,
      rewardsToken : config.rewardsToken,
      rewardsPerPeriod : config.rewardsPerPeriod,
      periodLength : config.periodLength,
      timeLockPeriod : config.timeLockPeriod,
    };

    const argsForDeployERC20  : IERC20DeployArgs = config;

    const campaignConfig : DCConfig = {
      env: "dev",
      deployAdmin: deployer,
      postDeploy: {
        tenderlyProjectSlug: "string",
        monitorContracts: false,
        verifyContracts: false,
      },
      owner,
      stakingERC20Config: argsForDeployERC20,
      stakingERC721Config: argsForDeployERC721,
    };

    const campaign = await runCampaign({
      config: campaignConfig,
      missions: [
        ZModulesStakingERC721DM,
      ],
    });

    const { stakingERC721 } = campaign;

    stakingContractERC721 = stakingERC721;

    dbAdapter = campaign.dbAdapter;

    // Give staking contract balance to pay rewards
    await rewardToken.connect(deployer).transfer(
      await stakingContractERC721.getAddress(),
      hre.ethers.parseEther("8000000000000")
    );

    await stakingToken.connect(owner).mint(stakerA.address, tokenIdA);
    await stakingToken.connect(owner).mint(stakerA.address, tokenIdB);
    await stakingToken.connect(owner).mint(stakerA.address, tokenIdC);
    await stakingToken.connect(owner).mint(owner.address, nonStakedTokenId);

    await stakingToken.connect(deployer).mint(owner.address, tokenIdX);

    await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdA);
    await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdB);
    await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdC);

    await stakingToken.connect(owner).approve(await stakingContractERC721.getAddress(), tokenIdX);
  });

  after(async () => {
    await dbAdapter.dropDB();
  });

  it("Should NOT deploy with zero values passed", async () => {
    const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");

    await expect(
      stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        hre.ethers.ZeroAddress,
        rewardToken.target,
        config.rewardsPerPeriod,
        config.periodLength,
        config.timeLockPeriod,
        owner.address
      )
    ).to.be.revertedWithCustomError(stakingContractERC721, ZERO_INIT_ERR);

    await expect(
      stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        stakingToken.target,
        hre.ethers.ZeroAddress,
        config.rewardsPerPeriod,
        config.periodLength,
        config.timeLockPeriod,
        owner.address
      )
    ).to.be.revertedWithCustomError(stakingContractERC721, ZERO_INIT_ERR);

    await expect(
      stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        stakingToken.target,
        rewardToken.target,
        0,
        config.periodLength,
        config.timeLockPeriod,
        owner.address
      )
    ).to.be.revertedWithCustomError(stakingContractERC721, ZERO_INIT_ERR);

    await expect(
      stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        stakingToken.target,
        rewardToken.target,
        config.rewardsPerPeriod,
        0,
        config.timeLockPeriod,
        owner.address
      )
    ).to.be.revertedWithCustomError(stakingContractERC721, ZERO_INIT_ERR);
  });

  describe("#getContractRewardsBalance", () => {
    it("Allows a user to see the total rewards remaining in a pool", async () => {
      const rewardsInPool = await stakingContractERC721.getContractRewardsBalance();
      const poolBalance = await rewardToken.balanceOf(await stakingContractERC721.getAddress());
      expect(rewardsInPool).to.eq(poolBalance);
    });
  });

  describe("#stake", () => {
    it("Can stake an NFT and properly assign tokenURI using baseURI", async () => {
      await stakingContractERC721.connect(stakerA).stake([tokenIdA], [emptyUri]);
      stakedAtA = BigInt(await time.latest());

      balanceAtStakeOne = await stakingContractERC721.balanceOf(stakerA.address);

      const stakerData = await stakingContractERC721.stakers(stakerA.address);

      const tokenUri = await stakingContractERC721.tokenURI(tokenIdA);
      expect(tokenUri).to.eq(baseUri + tokenIdA);

      // User has staked their NFT and gained an SNFT
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(2); // still has tokenIdB and tokenIdC
      expect(await stakingContractERC721.balanceOf(stakerA.address)).to.eq(1);
      expect(stakerData.amountStaked).to.eq(1);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtA + config.timeLockPeriod);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
    });

    it("Can stake multiple NFTs", async () => {
      const supplyBefore = await stakingContractERC721.totalSupply();

      await stakingContractERC721.connect(stakerA).stake([tokenIdB, tokenIdC], [emptyUri, emptyUri]);

      const supplyAfter = await stakingContractERC721.totalSupply();

      stakedAtB = BigInt(await time.latest());

      balanceAtStakeTwo = await stakingContractERC721.balanceOf(stakerA.address);

      const stakerData = await stakingContractERC721.stakers(stakerA.address);

      expect(supplyAfter).to.eq(supplyBefore + 2n);
      // User has staked their remaining NFTs and gained two SNFTs
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingContractERC721.balanceOf(stakerA.address)).to.eq(3);
      expect(stakerData.amountStaked).to.eq(3);
      // Verify that the unlockTimestamp *has not* changed after the second stake
      expect(stakerData.unlockTimestamp).to.eq(stakedAtA + config.timeLockPeriod);
      // Verify that the lastUpdatedTimestamp *has* changed after the second stake
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtB);

      const totalSupply = await stakingContractERC721.totalSupply();
      expect(totalSupply).to.eq(3);
    });

    it("Fails when the user tries to transfer the SNFT", async () => {
      await expect(
        stakingContractERC721.connect(stakerA).transferFrom(
          stakerA.address,
          stakerB.address,
          tokenIdA
        )).to.be.revertedWithCustomError(stakingContractERC721, NON_TRANSFERRABLE_ERR);
    });

    it("Fails to stake when the token id is invalid", async () => {
      // Token is not minted, and so is invalid
      await expect(
        stakingContractERC721.connect(stakerA).stake([unmintedTokenId], [emptyUri])
      ).to.be.revertedWithCustomError(stakingContractERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);
    });

    it("Fails to stake when the token is already staked", async () => {
      // If the token is staked, the owner will be the staking contract not the original owner
      await expect(
        stakingContractERC721.connect(stakerA).stake([tokenIdA], [emptyUri])
      ).to.be.revertedWithCustomError(stakingContractERC721, INCORRECT_OWNER_TRANSFER_ERR)
        .withArgs(stakerA.address, tokenIdA, await stakingContractERC721.getAddress());
    });

    it("Fails to stake when the caller is not the owner of the NFT", async () => {
      // Staker does not own the token and cannot stake it
      await expect(
        stakingContractERC721.connect(stakerA).stake([nonStakedTokenId], [emptyUri])
      ).to.be.revertedWithCustomError(stakingContractERC721, INSUFFICIENT_APPROVAL_721_ERR)
        .withArgs(stakingContractERC721.target, nonStakedTokenId);
    });
  });

  describe("#getRemainingLockTime", () => {
    it("Allows the user to view the remaining time lock period for a stake", async () => {
      const remainingLockTime = await stakingContractERC721.connect(stakerA).getRemainingLockTime();
      const latest = await time.latest();

      const stakeData = await stakingContractERC721.stakers(stakerA.address);

      // Original lock period and remaining lock period time difference should be the same as
      // the difference between the latest timestamp and that token's stake timestamp
      expect(remainingLockTime).to.eq((stakeData.unlockTimestamp - BigInt(latest)));
    });

    it("Returns 0 for a staked user that is past their lock time", async () => {
      await time.increase(config.timeLockPeriod);

      const remainingLockTime = await stakingContractERC721.connect(stakerA).getRemainingLockTime();

      expect(remainingLockTime).to.eq(0n);
    });

    it("Returns 0 for users that have not staked", async () => {
      const remainingLockTime = await stakingContractERC721.connect(notStaker).getRemainingLockTime();

      expect(remainingLockTime).to.eq(0n);
    });
  });

  describe("#getPendingRewards", () => {
    it("Can view pending rewards for a user", async () => {
      // Move forward in time
      await time.increase(config.periodLength);

      const timestamp = BigInt(await time.latest());

      durationOne = stakedAtB - stakedAtA;
      durationTwo = timestamp - stakedAtB;

      const pendingRewards = await stakingContractERC721.connect(stakerA).getPendingRewards();

      const totalRewards = calcTotalRewards(
        [durationOne, durationTwo],
        [balanceAtStakeOne, balanceAtStakeTwo],
        config.rewardsPerPeriod,
        config.periodLength
      );

      // Pending rewards on-chain match totalRewards calculated by helper
      expect(pendingRewards).to.eq(totalRewards);
    });

    it("Returns 0 for users that have not passed a single time period", async () => {
      const tokenId = 5;
      await stakingToken.connect(deployer).mint(stakerB.address, tokenId);
      await stakingToken.connect(stakerB).approve(await stakingContractERC721.getAddress(), tokenId);

      await stakingContractERC721.connect(stakerB).stake([tokenId], [emptyUri]);
      const pendingRewards = await stakingContractERC721.connect(stakerB).getPendingRewards();
      expect(pendingRewards).to.eq(0n);
    });

    it("Returns 0 for users that have not staked", async () => {
      const pendingRewards = await stakingContractERC721.connect(notStaker).getPendingRewards();
      expect(pendingRewards).to.eq(0n);
    });
  });

  describe("#claim", () => {
    it("Can claim rewards when staked and past the timeLockPeriod", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const pendingRewards = await stakingContractERC721.connect(stakerA).getPendingRewards();

      await stakingContractERC721.connect(stakerA).claim();

      claimedAt = BigInt(await time.latest());

      const expectedRewards = calcTotalRewards(
        [durationOne, claimedAt - stakedAtB],
        [balanceAtStakeOne, balanceAtStakeTwo],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      // Verify that our calculations must always be in sync with what is on chain
      expect(expectedRewards).to.eq(pendingRewards);

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);

      // Cannot double claim, rewards are reset by timestamp change onchain
      // So calling to `claim` a second time immediately after will only yield the expected
      // return for that amount of time that has passed
      await stakingContractERC721.connect(stakerA).claim();

      const balanceAfterSecondClaim = await rewardToken.balanceOf(stakerA.address);

      const timestamp = BigInt(await time.latest());

      const expectedRewardsClaim2 = calcTotalRewards(
        [timestamp - claimedAt],
        [balanceAtStakeTwo],
        config.rewardsPerPeriod,
        config.periodLength
      );

      // Update after using in calculation
      claimedAt = BigInt(await time.latest());

      expect(balanceAfterSecondClaim).to.eq(balanceAfter + expectedRewardsClaim2);

      const stakerData = await stakingContractERC721.stakers(stakerA.address);

      // Verify `numStaked` has not changed
      expect(stakerData.amountStaked).to.eq(3);
      // Verify `lastUpdatedTimestamp` has changed
      expect(stakerData.lastUpdatedTimestamp).to.eq(claimedAt);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Fails to claim when not enough time has passed", async () => {
      // TODO myself: double check the role
      await stakingToken.connect(deployer).mint(stakerC.address, tokenIdDelayed);
      await stakingToken.connect(stakerC).approve(await stakingContractERC721.getAddress(), tokenIdDelayed);

      await stakingContractERC721.connect(stakerC).stake([tokenIdDelayed], [emptyUri]);

      // The user cannot claim as not enough time has passed
      await expect(
        stakingContractERC721.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(stakingContractERC721, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails to claim when the caller has no stakes", async () => {
      // Will fail when we check `onlyUnlocked` modifier first
      await expect(
        stakingContractERC721.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(stakingContractERC721, TIME_LOCK_NOT_PASSED_ERR);
    });
  });

  describe("#unstake", () => {
    it("Can unstake a token", async () => {
      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      // Regular unstake, not calling to "exit"
      const pendingRewards = await stakingContractERC721.connect(stakerA).getPendingRewards();

      await stakingContractERC721.connect(stakerA).unstake([tokenIdA], false);
      unstakedAt = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcTotalRewards(
        [unstakedAt - claimedAt],
        [balanceAtStakeTwo],
        config.rewardsPerPeriod,
        config.periodLength
      );

      expect(expectedRewards).to.eq(pendingRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);

      const stakerData = await stakingContractERC721.stakers(stakerA.address);

      // User has regained their NFT and the SNFT was burned
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingContractERC721.balanceOf(stakerA.address)).to.eq(2);
      expect(stakerData.amountStaked).to.eq(2);
      expect(stakerData.lastUpdatedTimestamp).to.eq(unstakedAt);
      expect(stakerData.owedRewards).to.eq(0n);

      await expect(
        stakingContractERC721.ownerOf(tokenIdA)
      ).to.be.revertedWithCustomError(stakingContractERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdA);
    });

    it("Can unstake multiple staked tokens", async () => {
      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const pendingRewards = await stakingContractERC721.connect(stakerA).getPendingRewards();

      await stakingContractERC721.connect(stakerA).unstake([tokenIdB, tokenIdC], false);
      secondUnstakedAt = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcTotalRewards(
        [secondUnstakedAt - unstakedAt],
        [balanceAtStakeTwo - 1n],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const stakerData = await stakingContractERC721.stakers(stakerA.address);

      expect(expectedRewards).to.eq(pendingRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);

      // User has regained their NFTs and the SNFT was burned
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(3);
      expect(await stakingContractERC721.balanceOf(stakerA.address)).to.eq(0);
      expect((await stakingContractERC721.stakers(stakerA.address)).amountStaked).to.eq(0);

      // Staker data has been reset when they have completely unstaked
      expect(stakerData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerData.unlockTimestamp).to.eq(0n);
      expect(stakerData.amountStaked).to.eq(0);
      expect(stakerData.owedRewards).to.eq(0n);

      await expect(
        stakingContractERC721.ownerOf(tokenIdB)
      ).to.be.revertedWithCustomError(stakingContractERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdB);
      await expect(
        stakingContractERC721.ownerOf(tokenIdC)
      ).to.be.revertedWithCustomError(stakingContractERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdC);
    });

    it("Fails to unstake when not enough time has passed", async () => {
      // Restake to be able to unstake again
      await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdA);
      await stakingContractERC721.connect(stakerA).stake([tokenIdA], [emptyUri]);

      await expect(
        stakingContractERC721.connect(stakerA).unstake([tokenIdA], false)
      ).to.be.revertedWithCustomError(stakingContractERC721, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails to unstake when token id is invalid", async () => {
      // Move time forward to avoid time lock related errors
      await time.increase(config.timeLockPeriod);
      await expect(
        stakingContractERC721.connect(stakerA).unstake([unmintedTokenId], false)
      ).to.be.revertedWithCustomError(stakingContractERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);
    });

    it("Fails to unstake when caller is not the owner of the SNFT", async () => {
      // If the user has no stakes, the reversion is by default a `TimeLockNotPassed`,
      // we had stakes here to avoid this path
      await stakingToken.connect(stakerA).transferFrom(stakerA.address, stakerB.address, tokenIdB);
      await stakingToken.connect(stakerB).approve(await stakingContractERC721.getAddress(), tokenIdB);
      await stakingContractERC721.connect(stakerB).stake([tokenIdB], [emptyUri]);
      await time.increase(config.timeLockPeriod);

      await expect(
        stakingContractERC721.connect(stakerB).unstake([tokenIdA], false)
      ).to.be.revertedWithCustomError(stakingContractERC721, INVALID_OWNER_ERR);

      // Reset
      await stakingContractERC721.connect(stakerB).unstake([tokenIdB], false);
    });

    it("Fails to unstake when token id is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist and so we can't unstake it
      await expect(
        stakingContractERC721.connect(stakerA).unstake([nonStakedTokenId], false)
      ).to.be.revertedWithCustomError(stakingContractERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(nonStakedTokenId);
    });
  });

  describe("#unstake with 'exit'", () => {
    it("Fails if the caller does not own the sNFT", async () => {
      await expect(
        stakingContractERC721.connect(stakerB).unstake([tokenIdA], true)
      ).to.be.revertedWithCustomError(stakingContractERC721, INVALID_OWNER_ERR);
    });

    it("Fails if the sNFT is invalid", async () => {
      // Because we `burn` on exit, the token would be invalid and it is the same test
      // as if the owner has already exited
      await expect(
        stakingContractERC721.connect(stakerB).unstake([unmintedTokenId], true)
      ).to.be.revertedWithCustomError(stakingContractERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);
    });

    it("Allows the user to remove their stake within the timelock period without rewards", async () => {
      await stakingToken.connect(stakerB).approve(await stakingContractERC721.getAddress(), tokenIdB);
      await stakingContractERC721.connect(stakerB).stake([tokenIdB], [emptyUri]);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      await stakingContractERC721.connect(stakerB).unstake([tokenIdB], true);

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(1);
      expect(await stakingContractERC721.balanceOf(stakerB.address)).to.eq(1); // still has delayed token staked
    });

    it("Allows the user to remove multiple stakes within the timelock period without rewards", async () => {
      await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerA.address, tokenIdB);

      // Stake multiple
      // await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdC);

      await stakingContractERC721.connect(stakerA).stake([tokenIdB, tokenIdC], [emptyUri, emptyUri]);

      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingContractERC721.balanceOf(stakerA.address)).to.eq(3);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      // Verify we can remove multiple stakes in a single tx
      await stakingContractERC721.connect(stakerA).unstake([tokenIdA, tokenIdB, tokenIdC], true);

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(3);
      expect(await stakingContractERC721.balanceOf(stakerA.address)).to.eq(0);
    });
  });

  describe("Events", () => {
    it("Staking emits a 'Staked' event", async () => {
      // Transfer back to staker so they can trigger the `Staked` event
      await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdA);

      await expect(stakingContractERC721.connect(stakerA).stake([tokenIdA], [emptyUri]))
        .to.emit(stakingContractERC721, STAKED_EVENT)
        .withArgs(stakerA.address, tokenIdA, config.stakingToken);

      stakedAtA = BigInt(await time.latest());
      balanceAtStakeOne = await stakingContractERC721.balanceOf(stakerA.address);
    });

    it("Staking multiple tokens emits multiple 'Staked' events", async () => {
      // Transfer back to staker so they can trigger the `Staked` event
      await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingContractERC721.getAddress(), tokenIdC);

      await expect(await stakingContractERC721.connect(stakerA).stake([tokenIdB, tokenIdC], [emptyUri, emptyUri]))
        .to.emit(stakingContractERC721, STAKED_EVENT)
        .withArgs(stakerA.address, tokenIdB, config.stakingToken)
        .to.emit(stakingContractERC721, STAKED_EVENT)
        .withArgs(stakerA.address, tokenIdC, config.stakingToken);

      stakedAtB = BigInt(await time.latest());

      balanceAtStakeTwo = await stakingContractERC721.balanceOf(stakerA.address);
    });

    it("Claim emits a 'Claimed' event", async () => {
      await time.increase(config.timeLockPeriod);

      const pendingRewards = await stakingContractERC721.connect(stakerA).getPendingRewards();

      await expect(await stakingContractERC721.connect(stakerA).claim())
        .to.emit(stakingContractERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, pendingRewards, config.rewardsToken);

      claimedAt = BigInt(await time.latest());
    });

    it("Unstake Emits 'Unstaked' and 'Claimed 'events", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const pendingRewards = await stakingContractERC721.connect(stakerA).getPendingRewards();

      await expect(
        await stakingContractERC721.connect(stakerA).unstake([tokenIdA], false)
      ).to.emit(stakingContractERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdA, config.stakingToken)
        .to.emit(stakingContractERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, pendingRewards, config.rewardsToken);

      // Can't use `.withArgs` helper when testing claim event as we can't adjust the
      // timestamp required for calculating the proper rewards amount
      unstakedAt = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const expectedRewards = calcTotalRewards(
        [unstakedAt - claimedAt],
        [balanceAtStakeTwo],
        config.rewardsPerPeriod,
        config.periodLength
      );

      expect(expectedRewards).to.eq(pendingRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
    });

    it("Unstaking multiple tokens emits multiple 'Unstaked' and 'Claimed' events", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const pendingRewards = await stakingContractERC721.connect(stakerA).getPendingRewards();

      await expect(await stakingContractERC721.connect(stakerA).unstake([tokenIdB, tokenIdC], false))
        .to.emit(stakingContractERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdB, config.stakingToken)
        .to.emit(stakingContractERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdC, config.stakingToken)
        .to.emit(stakingContractERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, pendingRewards, config.rewardsToken);

      // Cannot verify 'CLAIMED_EVENT' using '.withArgs' because we can't manipulate the
      // timestamp to calculate the expected rewards until after the tx
      const timestamp = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const expectedRewards = calcTotalRewards(
        [timestamp - unstakedAt],
        [balanceAtStakeTwo - 1n],
        config.rewardsPerPeriod,
        config.periodLength
      );

      // Update after calculation
      unstakedAt = BigInt(await time.latest());

      expect(expectedRewards).to.eq(pendingRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
    });
  });

  describe("Other configs", () => {
    it ("Can't use the stakingContractERC721 contract when an IERC20 is the staking token", async () => {
      const localConfig = {
        stakingToken: await rewardToken.getAddress(),
        rewardsToken: await stakingToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig.stakingToken,
        localConfig.rewardsToken,
        localConfig.rewardsPerPeriod,
        localConfig.periodLength,
        localConfig.timeLockPeriod,
        owner.address
      ) as StakingERC721;

      // Realistically, they should never approve the contract for erc20 spending
      await rewardToken.connect(stakerA).approve(await localStakingERC721.getAddress(), hre.ethers.MaxUint256);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      // Can't catch this using `await expect(...)` so must try/catch instead
      /** eslint-disable @typescript-eslint/no-explicit-any */
      try {
        await localStakingERC721.connect(stakerA).stake([tokenIdA], [emptyUri]);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FUNCTION_SELECTOR_ERR);
      }
    });

    it("Can't use the stakingContractERC721 contract when an IERC721 is the rewards token", async () => {
      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await stakingToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig.stakingToken,
        localConfig.rewardsToken,
        localConfig.rewardsPerPeriod,
        localConfig.periodLength,
        localConfig.timeLockPeriod,
        owner.address
      ) as StakingERC721;

      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      await localStakingERC721.connect(stakerA).stake([tokenIdA], [emptyUri]);

      await time.increase(localConfig.timeLockPeriod);

      try {
        await localStakingERC721.connect(stakerA).claim();
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FAILED_INNER_CALL_ERR);
      }

      try {
        // In this flow balance is checked before trying to transfer, and so this will
        // fail first
        await localStakingERC721.connect(stakerA).unstake([tokenIdA], false);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(NO_REWARDS_ERR);
      }

      try {
        // After providing balance to the contract, we see it now fails correctly as it can't recognize
        // the function selector being called in unstake
        await stakingToken.connect(owner).mint(await localStakingERC721.getAddress(), 1010101);
        await localStakingERC721.connect(stakerA).unstake([tokenIdA], false);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FAILED_INNER_CALL_ERR);
      }

      await expect(localStakingERC721.connect(stakerA).unstake([tokenIdA], true)).to.not.be.reverted;
    });

    it("Can't use 0 as the period length", async () => {
      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await stakingToken.getAddress(),
        rewardsPerPeriod: BigInt(3),
        periodLength: BigInt(0),
        timeLockPeriod: BigInt(50),
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      try {
        await stakingFactory.deploy(
          "StakingNFT",
          "SNFT",
          baseUri,
          localConfig.stakingToken,
          localConfig.rewardsToken,
          localConfig.rewardsPerPeriod,
          localConfig.periodLength,
          localConfig.timeLockPeriod,
          owner.address
        );
      } catch (e : unknown) {
        expect((e as Error).message).to.include(ZERO_INIT_ERR);
      }
    });

    it("Can't transfer rewards when there is no rewards balance", async () => {
      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await rewardToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig.stakingToken,
        localConfig.rewardsToken,
        localConfig.rewardsPerPeriod,
        localConfig.periodLength,
        localConfig.timeLockPeriod,
        owner.address
      ) as StakingERC721;

      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      await localStakingERC721.connect(stakerA).stake([tokenIdA], [emptyUri]);

      await time.increase(localConfig.timeLockPeriod);

      const rewardsInPool = await localStakingERC721.getContractRewardsBalance();
      expect(rewardsInPool).to.eq(0);

      await expect(
        localStakingERC721.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(stakingContractERC721, NO_REWARDS_ERR);

      // Reset
      await localStakingERC721.connect(stakerA).unstake([tokenIdA], true);
    });

    it("More complex use case involving multiple stakes and stakers", async () => {

      /** Script
       * mint stakerB tokens D, E, F, G
       * mint stakerC tokens H, I
       * approvals for all stakers and tokens
       * stakerA stakes A, B, C
       * stakerB stakes D, E, F
       * stakerA tries to claim, fails
       * stakerB tries to claim, fails
       * time passes
       * stakerA claims rewards
       * stakerB tries to claim, fails
       * stakerC tries to stake H and G, fails as doesnt own G
       * stakerC stakes H and I
       * stakerB unstakes D
       * stakerB stakes G
       * stakerA unstakes all tokens, A, B, and C
       * stakerC tries to claim, fails
       * time passes
       * stakerC claims rewards
       * stakerB unstakes E and F
       * stakerB transfers D to stakerA
       * stakerB transfers E to stakerC
       * stakerB tries to transfer sNFT of G to stakerC, fails
       * stakerC claims rewards
       * stakerA stakes A, B
       * stakerA tries to unstake A, fails
       * stakerA stakes C and D
       * stakerB exits with G
       * stakerC unstakes H and I
       * stakerA tries to claim, fails
       * time passes
       * stakerA tries to claim, no rewards left in contract
       * stakerA exits with A, B, C, and D
       */
      const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
      const newMockERC20 = await mockERC20Factory.deploy("WILD", "WilderWorld");

      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await newMockERC20.getAddress(),
        rewardsPerPeriod: BigInt(13),
        periodLength: BigInt(56),
        timeLockPeriod: BigInt(897),
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig.stakingToken,
        localConfig.rewardsToken,
        localConfig.rewardsPerPeriod,
        localConfig.periodLength,
        localConfig.timeLockPeriod,
        owner.address
      ) as StakingERC721;

      // New tokenIds
      const tokenIdD = 10;
      const tokenIdE = 11;
      const tokenIdF = 12;
      const tokenIdG = 13;
      const tokenIdH = 14;
      const tokenIdI = 15;

      // New tokens for stakerB
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdD);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdE);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdF);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdG);

      // New tokens for stakerC
      await stakingToken.connect(owner).mint(stakerC.address, tokenIdH);
      await stakingToken.connect(owner).mint(stakerC.address, tokenIdI);

      // Approvals for stakerA
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdC);

      // Approvals for stakerB
      await stakingToken.connect(stakerB).approve(await localStakingERC721.getAddress(), tokenIdD);
      await stakingToken.connect(stakerB).approve(await localStakingERC721.getAddress(), tokenIdE);
      await stakingToken.connect(stakerB).approve(await localStakingERC721.getAddress(), tokenIdF);
      await stakingToken.connect(stakerB).approve(await localStakingERC721.getAddress(), tokenIdG);

      // Approvals for stakerC
      await stakingToken.connect(stakerC).approve(await localStakingERC721.getAddress(), tokenIdH);
      await stakingToken.connect(stakerC).approve(await localStakingERC721.getAddress(), tokenIdI);

      let stakerAData = await localStakingERC721.stakers(stakerA.address);
      let stakerBData = await localStakingERC721.stakers(stakerB.address);
      let stakerCData = await localStakingERC721.stakers(stakerC.address);

      // Verify all users have no stake information
      expect(stakerAData.amountStaked).to.eq(0);
      expect(stakerAData.unlockTimestamp).to.eq(0);
      expect(stakerAData.lastUpdatedTimestamp).to.eq(0);
      expect(stakerAData.owedRewards).to.eq(0);

      expect(stakerBData.amountStaked).to.eq(0);
      expect(stakerBData.unlockTimestamp).to.eq(0);
      expect(stakerBData.lastUpdatedTimestamp).to.eq(0);
      expect(stakerBData.owedRewards).to.eq(0);

      expect(stakerCData.amountStaked).to.eq(0);
      expect(stakerCData.unlockTimestamp).to.eq(0);
      expect(stakerCData.lastUpdatedTimestamp).to.eq(0);
      expect(stakerCData.owedRewards).to.eq(0);

      await localStakingERC721.connect(stakerA).stake([tokenIdA, tokenIdB, tokenIdC], [emptyUri, emptyUri, emptyUri]);
      let origStakedAtA = BigInt(await time.latest());
      stakedAtA = origStakedAtA;
      let balanceAtStakeOneA = await localStakingERC721.balanceOf(stakerA.address);

      stakerAData = await localStakingERC721.stakers(stakerA.address);

      // `numStaked` was updated
      expect(stakerAData.amountStaked).to.eq(3);
      // `lastUpdatedTimestamp` was updated
      expect(stakerAData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerAData.owedRewards).to.eq(0n);
      // Unlock timestamp was set
      expect(stakerAData.unlockTimestamp).to.eq(stakedAtA + localConfig.timeLockPeriod);

      // Verify balance changes
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(3);

      // Verify ownership changes
      expect(await stakingToken.ownerOf(tokenIdA)).to.eq(await localStakingERC721.getAddress());
      expect(await stakingToken.ownerOf(tokenIdB)).to.eq(await localStakingERC721.getAddress());
      expect(await stakingToken.ownerOf(tokenIdC)).to.eq(await localStakingERC721.getAddress());

      // Arbitrary value to represent delay between when stakerA and stakerB stake
      const delayOne = 41n;
      await time.increase(delayOne);

      // Stake 3 of the 4 that stakerB has
      await localStakingERC721.connect(stakerB).stake([tokenIdD, tokenIdE, tokenIdF], [emptyUri, emptyUri, emptyUri]);
      const origStakeAtB = BigInt(await time.latest());
      stakedAtB = origStakeAtB;
      let balanceAtStakeOneB = await localStakingERC721.balanceOf(stakerB.address);

      stakerBData = await localStakingERC721.stakers(stakerB.address);

      // `numStaked` was updated
      expect(stakerBData.amountStaked).to.eq(3);
      // `lastUpdatedTimestamp` was updated
      expect(stakerBData.lastUpdatedTimestamp).to.eq(stakedAtB);
      expect(stakerBData.owedRewards).to.eq(0n);
      // Unlock timestamp was set
      expect(stakerBData.unlockTimestamp).to.eq(stakedAtB + localConfig.timeLockPeriod);

      // Verify balance changes
      expect(
        await stakingToken.balanceOf(stakerB.address)
      ).to.eq(1); // was minted 4 tokens, only staked 3 so far
      expect(
        await stakingToken.balanceOf(await localStakingERC721.getAddress())
      ).to.eq(6); // 3 from stakerA, 3 from stakerB

      // Verify ownership changes
      expect(await stakingToken.ownerOf(tokenIdD)).to.eq(await localStakingERC721.getAddress());
      expect(await stakingToken.ownerOf(tokenIdE)).to.eq(await localStakingERC721.getAddress());
      expect(await stakingToken.ownerOf(tokenIdF)).to.eq(await localStakingERC721.getAddress());

      // Too early to claim rewards for StakerA
      await expect(
        localStakingERC721.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Too early to claim rewards for StakerB
      await expect(
        localStakingERC721.connect(stakerB).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Increase time beyond the time lock period
      const addedTime = 14n; // Arbitrary value
      await time.increase(localConfig.timeLockPeriod + addedTime - delayOne);

      let rewardsBalanceBeforeA = await newMockERC20.balanceOf(stakerA.address);
      let pendingRewardsA = await localStakingERC721.connect(stakerA).getPendingRewards();

      // Only transfer what we need so we can have an empty rewards contract at the end
      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsA
      );

      // stakerA can successfully claim
      await localStakingERC721.connect(stakerA).claim();
      const claimedAtA = BigInt(await time.latest());

      // Verify we only transferred the exact amount necessary
      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      // Still too early for stakerB
      await expect(
        localStakingERC721.connect(stakerB).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Verify stakerA's rewards
      let rewardsBalanceAfterA = await newMockERC20.balanceOf(stakerA.address);

      let expectedRewardsA = calcTotalRewards(
        [claimedAtA - stakedAtA],
        [balanceAtStakeOneA],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      expect(expectedRewardsA).to.eq(pendingRewardsA);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA + expectedRewardsA);

      stakerAData = await localStakingERC721.stakers(stakerA.address);

      // `numStaked` was not changed in `claim`
      expect(stakerAData.amountStaked).to.eq(3);
      // `lastUpdatedTimestamp` was updated
      expect(stakerAData.lastUpdatedTimestamp).to.eq(claimedAtA);
      expect(stakerAData.owedRewards).to.eq(0n);

      // stakerC stakes using one token that is theirs and one token that is not
      // so the stake fails
      await expect(
        localStakingERC721.connect(stakerC).stake([tokenIdH, tokenIdG], [emptyUri, emptyUri])
      ).to.be.revertedWithCustomError(localStakingERC721, INCORRECT_OWNER_TRANSFER_ERR)
        .withArgs(stakerC.address, tokenIdG, await stakingToken.ownerOf(tokenIdG));

      // stakerC corrects mistake and calls to stake using only their tokens
      await localStakingERC721.connect(stakerC).stake([tokenIdH, tokenIdI], [emptyUri, emptyUri]);
      const origStakedAtC = BigInt(await time.latest());
      const stakedAtC = origStakedAtC;
      const balanceAtStakeOneC = await localStakingERC721.balanceOf(stakerC.address);

      // Verify balance and ownership change
      expect(
        await stakingToken.balanceOf(stakerC.address)
      ).to.eq(0);
      expect(
        await stakingToken.balanceOf(await localStakingERC721.getAddress())
      ).to.eq(8); // 3 from stakerA, 3 from stakerB, 2 from stakerC

      stakerCData = await localStakingERC721.stakers(stakerC.address);

      expect(stakerCData.amountStaked).to.eq(2);
      expect(stakerCData.lastUpdatedTimestamp).to.eq(stakedAtC);
      expect(stakerCData.owedRewards).to.eq(0n);
      expect(stakerCData.unlockTimestamp).to.eq(stakedAtC + localConfig.timeLockPeriod);

      await time.increase(delayOne);

      let pendingRewardsB = await localStakingERC721.connect(stakerB).getPendingRewards();
      let rewardsBalanceBeforeB = await newMockERC20.balanceOf(stakerB.address);

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsB
      );

      await localStakingERC721.connect(stakerB).unstake([tokenIdD], false);
      let unstakedAtB = BigInt(await time.latest());
      const claimedAtB = unstakedAtB;

      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      let rewardsBalanceAfterB = await newMockERC20.balanceOf(stakerB.address);

      let expectedRewardsB = calcTotalRewards(
        [unstakedAtB - stakedAtB],
        [balanceAtStakeOneB],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      balanceAtStakeOneB = await localStakingERC721.balanceOf(stakerB.address);

      expect(expectedRewardsB).to.eq(pendingRewardsB);
      expect(rewardsBalanceAfterB).to.eq(rewardsBalanceBeforeB + expectedRewardsB);

      // Verify balance and ownership change
      expect(
        await stakingToken.balanceOf(stakerB.address)
      ).to.eq(2); // staked 3 / 4 tokens, then unstaked 1, now owns 2 and has staked 2
      expect(
        await stakingToken.balanceOf(await localStakingERC721.getAddress())
      ).to.eq(7);

      stakerBData = await localStakingERC721.stakers(stakerB.address);

      expect(stakerBData.amountStaked).to.eq(2);
      expect(stakerBData.lastUpdatedTimestamp).to.eq(claimedAtB);
      expect(stakerBData.owedRewards).to.eq(0n);

      // Unlock period was not changed as we did not remove all staked tokens
      expect(stakerBData.unlockTimestamp).to.eq(stakedAtB + localConfig.timeLockPeriod);

      const delayTwo = 23n;
      await time.increase(delayTwo);

      rewardsBalanceBeforeB = await newMockERC20.balanceOf(stakerB.address);

      // stakerB calls to stake on tokenG
      await localStakingERC721.connect(stakerB).stake([tokenIdG], [emptyUri]);
      rewardsBalanceAfterB = await newMockERC20.balanceOf(stakerB.address);
      stakedAtB = BigInt(await time.latest());
      const balanceAtStakeTwoB = await localStakingERC721.balanceOf(stakerB.address);

      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(1);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(8);


      stakerBData = await localStakingERC721.stakers(stakerB.address);

      expect(stakerBData.amountStaked).to.eq(3);
      expect(stakerBData.lastUpdatedTimestamp).to.eq(stakedAtB);
      // Unlock period was not changed
      expect(stakerBData.unlockTimestamp).to.eq(origStakeAtB + localConfig.timeLockPeriod);

      expectedRewardsB = calcTotalRewards(
        [stakedAtB - unstakedAtB],
        [balanceAtStakeOneB],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      pendingRewardsB = await localStakingERC721.connect(stakerB).getPendingRewards();

      // New pending rewards are showed
      expect(expectedRewardsB).to.eq(pendingRewardsB);

      // But staker doesn't actually receive rewards until claim or unstake
      expect(rewardsBalanceAfterB).to.eq(rewardsBalanceBeforeB);

      expect(stakerBData.owedRewards).to.eq(expectedRewardsB);

      rewardsBalanceBeforeA = await newMockERC20.balanceOf(stakerA.address);
      pendingRewardsA = await localStakingERC721.connect(stakerA).getPendingRewards();

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsA
      );

      // Completely exit the staking contract
      await localStakingERC721.connect(stakerA).unstake([tokenIdA, tokenIdB, tokenIdC], false);
      const unstakedAtA = BigInt(await time.latest());

      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      rewardsBalanceAfterA = await newMockERC20.balanceOf(stakerA.address);

      stakerAData = await localStakingERC721.stakers(stakerA.address);

      expectedRewardsA = calcTotalRewards(
        [unstakedAtA - claimedAtA],
        [balanceAtStakeOneA],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      expect(pendingRewardsA).to.eq(expectedRewardsA);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA + expectedRewardsA);

      // Verify total reset
      expect(stakerAData.amountStaked).to.eq(0);
      expect(stakerAData.lastUpdatedTimestamp).to.eq(0);
      expect(stakerAData.owedRewards).to.eq(0n);
      expect(stakerAData.unlockTimestamp).to.eq(0n);

      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(3);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(5);
      expect(await localStakingERC721.balanceOf(stakerA.address)).to.eq(0);

      // Too early to claim for stakerC
      await expect(
        localStakingERC721.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Move to exact timestamp stakerC can claim
      await time.increase(localConfig.timeLockPeriod - delayTwo);

      let pendingRewardsC = await localStakingERC721.connect(stakerC).getPendingRewards();
      let rewardsBalanceBeforeC = await newMockERC20.balanceOf(stakerC.address);

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsC
      );

      await localStakingERC721.connect(stakerC).claim();

      let claimedAtC = BigInt(await time.latest());
      let rewardsBalanceAfterC = await newMockERC20.balanceOf(stakerC.address);

      stakerCData = await localStakingERC721.stakers(stakerC.address);

      let expectedRewardsC = calcTotalRewards(
        [claimedAtC - stakedAtC],
        [balanceAtStakeOneC],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      expect(pendingRewardsC).to.eq(expectedRewardsC);
      expect(rewardsBalanceAfterC).to.eq(rewardsBalanceBeforeC + expectedRewardsC);

      // Value staked hasn't changed after claim
      expect(stakerCData.amountStaked).to.eq(2);
      // timestamp was updated by claim
      expect(stakerCData.lastUpdatedTimestamp).to.eq(claimedAtC);
      expect(stakerCData.owedRewards).to.eq(0n);
      // unlock timestamp has not changed
      expect(stakerCData.unlockTimestamp).to.eq(origStakedAtC + localConfig.timeLockPeriod);

      pendingRewardsB = await localStakingERC721.connect(stakerB).getPendingRewards();
      rewardsBalanceBeforeB = await newMockERC20.balanceOf(stakerB.address);

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsB
      );

      // stakerB will now own have D, E, F owned and G staked
      await localStakingERC721.connect(stakerB).unstake([tokenIdE, tokenIdF], false);
      unstakedAtB = BigInt(await time.latest()); // update timestamp yet?

      rewardsBalanceAfterB = await newMockERC20.balanceOf(stakerB.address);

      expectedRewardsB = calcTotalRewards(
        [unstakedAtB - stakedAtB],
        [balanceAtStakeTwoB],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      stakerBData = await localStakingERC721.stakers(stakerB.address);

      expect(expectedRewardsB).to.eq(pendingRewardsB);
      expect(rewardsBalanceAfterB).to.eq(rewardsBalanceBeforeB + expectedRewardsB);

      expect(stakerBData.amountStaked).to.eq(1);
      expect(stakerBData.lastUpdatedTimestamp).to.eq(unstakedAtB);
      expect(stakerBData.owedRewards).to.eq(0n);
      // Verify unchanged during unstake as we did not exit completely
      expect(stakerBData.unlockTimestamp).to.eq(origStakeAtB + localConfig.timeLockPeriod);

      // stakerB transfers tokenD to stakerA and tokenE to stakerC
      await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerA.address, tokenIdD);
      await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerC.address, tokenIdE);

      // Verify transfers
      expect(await stakingToken.ownerOf(tokenIdD)).to.eq(stakerA.address);
      expect(await stakingToken.ownerOf(tokenIdE)).to.eq(stakerC.address);

      // stakerB fails to transfer tokenG, it is a nontransferrable SNFT
      await expect(
        localStakingERC721.connect(stakerB).transferFrom(stakerB.address, stakerC.address, tokenIdG)
      ).to.be.revertedWithCustomError(localStakingERC721, NON_TRANSFERRABLE_ERR);

      await time.increase(config.periodLength * 5n);
      // stakerC claims rewards
      rewardsBalanceBeforeC = await newMockERC20.balanceOf(stakerC.address);
      pendingRewardsC = await localStakingERC721.connect(stakerC).getPendingRewards();

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsC
      );

      await localStakingERC721.connect(stakerC).claim();

      rewardsBalanceAfterC = await newMockERC20.balanceOf(stakerC.address);

      expectedRewardsC = calcTotalRewards(
        [BigInt(await time.latest()) - claimedAtC],
        [balanceAtStakeOneC],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      claimedAtC = BigInt(await time.latest());

      expect(expectedRewardsC).to.eq(pendingRewardsC);
      expect(rewardsBalanceAfterC).to.eq(rewardsBalanceBeforeC + expectedRewardsC);

      stakerCData = await localStakingERC721.stakers(stakerC.address);

      // Value staked is unchanged
      expect(stakerCData.amountStaked).to.eq(2);
      // Timestamp is updated
      expect(stakerCData.lastUpdatedTimestamp).to.eq(claimedAtC);
      // No pending rewards after claim
      expect(stakerCData.owedRewards).to.eq(0n);
      // Unlock timestamp is unchanged
      expect(stakerCData.unlockTimestamp).to.eq(origStakedAtC + localConfig.timeLockPeriod);

      // stakerA stakes tokenA and tokenB
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdB);

      await localStakingERC721.connect(stakerA).stake([tokenIdA, tokenIdB], [emptyUri, emptyUri]);
      origStakedAtA = BigInt(await time.latest());
      stakedAtA = origStakedAtA;

      balanceAtStakeOneA = await localStakingERC721.balanceOf(stakerA.address);

      stakerAData = await localStakingERC721.stakers(stakerA.address);

      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(2);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(5);

      // Verify updated user data
      expect(stakerAData.amountStaked).to.eq(2);
      expect(stakerAData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerAData.owedRewards).to.eq(0n);

      // Verify new unlock timestamp was set
      expect(stakerAData.unlockTimestamp).to.eq(stakedAtA + localConfig.timeLockPeriod);

      await time.increase(localConfig.periodLength * 2n);

      // Cannot unstake until the timelock has passed
      await expect(
        localStakingERC721.connect(stakerA).unstake([tokenIdA], false)
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Stake the next two owned tokens
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdC);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdD);

      rewardsBalanceBeforeA = await newMockERC20.balanceOf(stakerA.address);
      pendingRewardsA = await localStakingERC721.connect(stakerA).getPendingRewards();

      await localStakingERC721.connect(stakerA).stake([tokenIdC, tokenIdD], [emptyUri, emptyUri]);

      rewardsBalanceAfterA = await newMockERC20.balanceOf(stakerA.address);

      expectedRewardsA = calcTotalRewards(
        [BigInt(await time.latest()) - stakedAtA],
        [balanceAtStakeOneA],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      stakedAtA = BigInt(await time.latest());

      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(7);

      expect(expectedRewardsA).to.eq(pendingRewardsA);
      // No rewards are given until claim or unstake
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);

      stakerAData = await localStakingERC721.stakers(stakerA.address);

      expect(stakerAData.amountStaked).to.eq(4);
      expect(stakerAData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerAData.owedRewards).to.eq(expectedRewardsA);

      // stakerB exits without rewards
      rewardsBalanceBeforeB = await newMockERC20.balanceOf(stakerB.address);
      pendingRewardsB = await localStakingERC721.connect(stakerB).getPendingRewards();


      // stakerB unstakes tokenIdG without rewards
      await localStakingERC721.connect(stakerB).unstake([tokenIdG], true);
      unstakedAtB = BigInt(await time.latest());

      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      rewardsBalanceAfterB = await newMockERC20.balanceOf(stakerB.address);

      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(2);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(6);

      // No rewards given
      expect(rewardsBalanceAfterB).to.eq(rewardsBalanceBeforeB);

      stakerBData = await localStakingERC721.stakers(stakerB.address);

      expect(stakerBData.amountStaked).to.eq(0n);
      expect(stakerBData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerBData.owedRewards).to.eq(0n);
      expect(stakerBData.unlockTimestamp).to.eq(0n);

      rewardsBalanceBeforeC = await newMockERC20.balanceOf(stakerC.address);
      pendingRewardsC = await localStakingERC721.connect(stakerC).getPendingRewards();

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsC
      );

      await localStakingERC721.connect(stakerC).unstake([tokenIdH, tokenIdI], false);
      const unstakedAtC = BigInt(await time.latest());
      rewardsBalanceAfterC = await newMockERC20.balanceOf(stakerC.address);

      // Be sure we only transferred what we need
      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      expectedRewardsC = calcTotalRewards(
        [unstakedAtC - claimedAtC],
        [balanceAtStakeOneC],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      expect(expectedRewardsC).to.eq(pendingRewardsC);
      expect(rewardsBalanceAfterC).to.eq(rewardsBalanceBeforeC + expectedRewardsC);

      // tokenE, tokenH, and tokenI
      expect(await stakingToken.balanceOf(stakerC.address)).to.eq(3);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(4);
      expect(await localStakingERC721.balanceOf(stakerC.address)).to.eq(0);

      stakerCData = await localStakingERC721.stakers(stakerC.address);

      expect(stakerCData.amountStaked).to.eq(0n);
      expect(stakerCData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerCData.owedRewards).to.eq(0n);
      expect(stakerCData.unlockTimestamp).to.eq(0n);

      // No rewards remain in the pool
      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      // Too early for stakerA to claim
      await expect(
        localStakingERC721.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      await time.increase(origStakedAtA + localConfig.timeLockPeriod);

      // Even when the time lock has passed, we don't have the rewards necessary to claim
      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      // Cannot claim when the contract has no more rewards to distribute
      await expect(
        localStakingERC721.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, NO_REWARDS_ERR);

      rewardsBalanceBeforeA = await newMockERC20.balanceOf(stakerA.address);

      // Must exit
      await localStakingERC721.connect(stakerA).unstake([tokenIdA, tokenIdB, tokenIdC, tokenIdD], true);

      rewardsBalanceAfterA = await newMockERC20.balanceOf(stakerA.address);

      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);

      stakerAData = await localStakingERC721.stakers(stakerA.address);

      expect(stakerAData.amountStaked).to.eq(0n);
      expect(stakerAData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerAData.owedRewards).to.eq(0n);
      expect(stakerAData.unlockTimestamp).to.eq(0n);

      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(4);
      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(2);
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(4);

      // There are no remaining stakes
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(0);
    });
  });

  describe("Helper functions", () => {
    it("#setBaseURI() should set the base URI", async () => {
      await stakingToken.connect(stakerA).approve(stakingContractERC721.target, tokenIdA);
      await stakingContractERC721.connect(stakerA).stake([tokenIdA], [emptyUri]);

      const newBaseUri = "https://newbaseuri.com/";
      await stakingContractERC721.connect(owner).setBaseURI(newBaseUri);

      expect(await stakingContractERC721.tokenURI(tokenIdA)).to.eq(newBaseUri + tokenIdA);
    });

    it("#setTokenURI() should set the token URI and return it properly when baseURI is empty", async () => {
      const newTokenUri = "https://newtokenuri.com/";
      await stakingContractERC721.connect(owner).setBaseURI("");
      await stakingContractERC721.connect(owner).setTokenURI(tokenIdA, newTokenUri);

      const uriFromContract = await stakingContractERC721.tokenURI(tokenIdA);

      expect(uriFromContract).to.eq(newTokenUri);

      await stakingContractERC721.connect(stakerA).unstake([tokenIdA], true);
    });

    // eslint-disable-next-line max-len
    it("#stake() with passed tokenURI should set the token URI when baseURI is empty and change back to baseURI when needed", async () => {
      const newTokenUri = "https://specialtokenuri.com/";
      await stakingToken.connect(stakerA).approve(stakingContractERC721.target, tokenIdA);
      await stakingContractERC721.connect(stakerA).stake([tokenIdA], [newTokenUri]);

      const uriFromContract = await stakingContractERC721.tokenURI(tokenIdA);
      expect(uriFromContract).to.eq(newTokenUri);

      await stakingContractERC721.connect(owner).setBaseURI(baseUri);
      await stakingContractERC721.connect(owner).setTokenURI(tokenIdA, "");

      const newURI = await stakingContractERC721.tokenURI(tokenIdA);
      expect(newURI).to.eq(baseUri + tokenIdA);
    });

    it("#withdrawLeftoverRewards() should withdraw all remaining rewards and emit an event", async () => {
      const contractBalBefore = await rewardToken.balanceOf(stakingContractERC721.target);
      expect(contractBalBefore).to.be.gt(0);

      await expect(
        stakingContractERC721.connect(owner).withdrawLeftoverRewards()
      ).to.emit(stakingContractERC721, WITHDRAW_EVENT)
        .withArgs(owner.address, contractBalBefore);

      const contractBalAfter = await rewardToken.balanceOf(stakingContractERC721.target);
      expect(contractBalAfter).to.eq(0);
    });

    it("#withdrawLeftoverRewards() should revert if contract balance is 0", async () => {
      await expect(
        stakingContractERC721.connect(owner).withdrawLeftoverRewards()
      ).to.be.revertedWithCustomError(stakingContractERC721, NO_REWARDS_ERR);
    });

    it("#withdrawLeftoverRewards() should only be callable by the owner", async () => {
      await expect(
        stakingContractERC721.connect(notStaker).withdrawLeftoverRewards()
      ).to.be.revertedWithCustomError(stakingContractERC721, OWNABLE_UNAUTHORIZED_ERR)
        .withArgs(notStaker.address);
    });

    it("#supportsInterface() should return true for ERC721 interface or interface of staking contract", async () => {
      // get the interface ids programmatically
      const erc721InterfaceId = "0x80ac58cd";

      const stakingInterface = await stakingContractERC721.getInterfaceId();

      expect(await stakingContractERC721.supportsInterface(erc721InterfaceId)).to.eq(true);
      expect(await stakingContractERC721.supportsInterface(stakingInterface)).to.eq(true);
    });

    it("Should allow to change ownership", async () => {
      await stakingContractERC721.connect(owner).transferOwnership(notStaker.address);

      expect(await stakingContractERC721.owner()).to.eq(notStaker.address);
    });
  });

  describe("Deploy", () => {

    it("Deployed contract should exist in the DB", async () => {
      const nameOfContract = contractNames.stakingERC721.contract;
      const dbAddress = await stakingContractERC721.getAddress();
      const contractFromDB = await dbAdapter.getContract(nameOfContract);

      expect({
        addrs: contractFromDB?.address,
        label: contractFromDB?.name,
      }).to.deep.equal({
        addrs: dbAddress,
        label: nameOfContract,
      });
    });

    it("Should be deployed with correct args", async () => {

      const expectedArgs = {
        rewardsToken: await stakingContractERC721.rewardsToken(),
        stakingToken: await stakingContractERC721.stakingToken(),
        rewardsPerPeriod: await stakingContractERC721.rewardsPerPeriod(),
        periodLength: await stakingContractERC721.periodLength(),
        timeLockPeriod: await stakingContractERC721.timeLockPeriod(),
      };

      expect(expectedArgs.rewardsToken).to.eq(config.rewardsToken);
      expect(expectedArgs.stakingToken).to.eq(config.stakingToken);
      expect(expectedArgs.rewardsPerPeriod).to.eq(config.rewardsPerPeriod);
      expect(expectedArgs.periodLength).to.eq(config.periodLength);
      expect(expectedArgs.timeLockPeriod).to.eq(config.timeLockPeriod);
    });

    it("Should have correct db and contract versions", async () => {

      const tag = await acquireLatestGitTag();
      const contractFromDB = await dbAdapter.getContract(contractNames.stakingERC721.contract);
      const dbDeployedV = await dbAdapter.versioner.getDeployedVersion();

      expect({
        dbVersion: contractFromDB?.version,
        contractVersion: dbDeployedV?.contractsVersion,
      }).to.deep.equal({
        dbVersion: dbDeployedV.dbVersion,
        contractVersion: tag,
      });
    });

    it("should allow to renounce ownership", async () => {
      await stakingContractERC721.connect(notStaker).renounceOwnership();

      expect(await stakingContractERC721.owner()).to.eq(hre.ethers.ZeroAddress);
    });
  });
});
