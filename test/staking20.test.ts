import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20,
  StakingERC20,
} from "../typechain";
import {
  createDefaultConfigs,
  calcTotalRewards,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  INCORRECT_OWNER_TRANSFER_ERR,
  INVALID_OWNER_ERR,
  INVALID_TOKEN_ID_ERR,
  NO_REWARDS_ERR,
  ONLY_NFT_OWNER_ERR,
  TIME_LOCK_NOT_PASSED_ERR,
  BaseConfig,
  UNTRANSFERRABLE_ERR,
  FUNCTION_SELECTOR_ERR,
  DIV_BY_ZERO_ERR,
  INSUFFICIENT_ALLOWANCE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  ZERO_STAKE_ERR,
} from "./helpers/staking";

describe("StakingERC20", () => {

  let deployer : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let contract : StakingERC20;

  let stakeToken : MockERC20;
  let rewardsToken : MockERC20;
  
  // We don't use `PoolConfig` anymore on the contracts but for convenience in testing
  // we can leave this type where it is
  let config : BaseConfig;
  
  let stakedAtA: bigint;
  let stakedAtB: bigint;

  let balanceAtStakeOneA: bigint;
  let balanceAtUnstakeA: bigint;
  let claimedAtA: bigint;
  let unstakedAtA: bigint;

  let balanceAtStakeOneB: bigint;

  let durationOne: bigint;
  let durationTwo: bigint;

  // Default token ids
  let initBalance: bigint = hre.ethers.parseEther("1000000000000");

  before(async () => {
    [
      deployer,
      stakerA,
      stakerB,
      stakerC,
      notStaker,
    ] = await hre.ethers.getSigners();

    const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    stakeToken = await mockERC20Factory.deploy("MEOW", "MEOW");

    rewardsToken = await mockERC20Factory.deploy("WilderWorld", "WW");

    config = await createDefaultConfigs(rewardsToken, undefined, stakeToken);

    const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");
    contract = await stakingFactory.deploy(
      config.stakingToken,
      config.rewardsToken,
      config.rewardsPerPeriod,
      config.periodLength,
      config.timeLockPeriod
    ) as StakingERC20;

    // Give staking contract balance to pay rewards
    await rewardsToken.connect(deployer).transfer(
      await contract.getAddress(),
      hre.ethers.parseEther("8000000000000")
    );

    // Give each user funds to stake
    await stakeToken.connect(deployer).transfer(
      stakerA.address,
      initBalance
    );

    await stakeToken.connect(deployer).transfer(
      stakerB.address,
      initBalance
    );

    await stakeToken.connect(deployer).transfer(
      stakerC.address,
      initBalance
    );

    // Approve staking contract to spend staker funds
    await stakeToken.connect(stakerA).approve(await contract.getAddress(), initBalance);
    await stakeToken.connect(stakerB).approve(await contract.getAddress(), initBalance);
    await stakeToken.connect(stakerC).approve(await contract.getAddress(), initBalance);
  });

  describe("#getContractRewardsBalance", () => {
    it("Allows a user to see the total rewards remaining in a pool", async () => {
      const rewardsInPool = await contract.getContractRewardsBalance();
      const poolBalance = await rewardsToken.balanceOf(await contract.getAddress());
      expect(rewardsInPool).to.eq(poolBalance);
    });
  });

  describe("#stake", () => {
    it("Can stake an amount successfully", async () => {
      const amount = initBalance / 10000n;

      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stake(amount);
      stakedAtA = BigInt(await time.latest());
      balanceAtStakeOneA = amount;

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      // const staked = await contract.getStakedBalance(stakerA.address);
      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - amount);

      expect(stakerData.amountStaked).to.eq(amount);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtA + config.timeLockPeriod);
      expect(stakerData.pendingRewards).to.eq(0n);
    });

    it("Fails when the staker doesn't have the funds to stake", async () => {
      const amount = initBalance * 10000n;

      // First, it will fail on allowance
      await expect(
        contract.connect(notStaker).stake(amount)
      ).to.be.revertedWith(INSUFFICIENT_ALLOWANCE_ERR);

      // Then after we allow funds, it will fail on balance
      await stakeToken.connect(notStaker).approve(await contract.getAddress(), amount);
      await expect(
        contract.connect(notStaker).stake(amount)
      ).to.be.revertedWith(INSUFFICIENT_BALANCE_ERR);
    });

    it("Fails when the staker tries to stake 0", async () => {
      // TODO Should we bother preventing this case?
      await expect(
        contract.connect(stakerA).stake(0n)
      ).to.be.revertedWithCustomError(contract, ZERO_STAKE_ERR);
    });
  });

  describe("#getRemainingLockTime", () => {
    it("Allows the user to view the remaining time lock period for a stake", async () => {
      // await time.increase(config.timeLockPeriod / 5n);

      const remainingLockTime = await contract.connect(stakerA).getRemainingLockTime();
      const latest = await time.latest();

      const stakeData = await contract.stakers(stakerA.address);

      // Original lock period and remaining lock period time difference should be the same as
      // the difference between the latest timestamp and that token's stake timestamp
      expect(remainingLockTime).to.eq((stakeData.unlockTimestamp - BigInt(latest)));
    });

    it("Returns 0 for a user that's their lock time", async () => {
      await time.increase(config.timeLockPeriod);

      const remainingLockTime = await contract.connect(stakerA).getRemainingLockTime();
      expect(remainingLockTime).to.eq(0n);
    })

    it("Returns 0 for a user that has not staked", async () => {
      const remainingLockTime = await contract.connect(notStaker).getRemainingLockTime();
      expect(remainingLockTime).to.eq(0n);
    });
  });

  describe("#getPendingRewards", () => {
    it("Allows the user to view the pending rewards for a stake", async () => {
      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const expectedRewards = calcTotalRewards(
        [BigInt(await time.latest()) - stakedAtA],
        [balanceAtStakeOneA],
        config.rewardsPerPeriod,
        config.periodLength
      );

      expect(pendingRewards).to.eq(expectedRewards);
    });

    it("Returns 0 for a user that has not staked", async () => {
      const pendingRewards = await contract.connect(notStaker).getPendingRewards();
      expect(pendingRewards).to.eq(0n);
    });

    it("Returns 0 for a user that has staked but not passed a time period", async () => {
      const amount = initBalance / 10000n;
      await contract.connect(stakerB).stake(amount);
      stakedAtB = BigInt(await time.latest());
      balanceAtStakeOneB = amount;

      const stakerData = await contract.stakers(stakerB.address);

      const pendingRewards = await contract.connect(stakerB).getPendingRewards();

      expect(pendingRewards).to.eq(0n);
      expect(stakerData.pendingRewards).to.eq(0n);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtB);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtB + config.timeLockPeriod);
      expect(stakerData.amountStaked).to.eq(amount);
    });
  });

  describe("#claim", () => {
    it("Allows the user to claim their rewards", async () => {
      const pendingRewards = await contract.connect(stakerA).getPendingRewards();
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).claim();
      claimedAtA = BigInt(await time.latest());

      const expectedRewards = calcTotalRewards(
        [claimedAtA - stakedAtA],
        [balanceAtStakeOneA],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(pendingRewards).to.eq(expectedRewards);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + pendingRewards);

      const stakerData = await contract.stakers(stakerA.address);
      expect(stakerData.pendingRewards).to.eq(0n);
    });

    it("Fails when the user has never staked", async () => {
      // `onlyUnlocked` is the first thing checked in this flow
      // and fails when the user has no set unlock timestamp
      await expect(
        contract.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    });
  });

  describe("#unstake", () => {
    it("Allows a user to unstake partially", async () => {
      await time.increase(config.periodLength * 7n);

      const amount = balanceAtStakeOneA / 2n;
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      await stakeToken.connect(stakerA).approve(await contract.getAddress(), amount);

      await contract.connect(stakerA).unstake(amount, false);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      unstakedAtA = BigInt(await time.latest());

      const expectedRewards = calcTotalRewards(
        [unstakedAtA - claimedAtA],
        [balanceAtStakeOneA],
        config.rewardsPerPeriod,
        config.periodLength
      );


      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + pendingRewards);
      expect(pendingRewards).to.eq(expectedRewards);

      const stakerData = await contract.stakers(stakerA.address);
      expect(stakerData.amountStaked).to.eq(balanceAtStakeOneA - amount);
      expect(stakerData.lastUpdatedTimestamp).to.eq(unstakedAtA);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtA + config.timeLockPeriod);
      expect(stakerData.pendingRewards).to.eq(0n);
    })
  });



  /**
   * getRemainingLockTime
   * getPendingRewards
   * claim
   * unstake
   * unstake with 'exit'
   * events
   * other configs
   */
});
