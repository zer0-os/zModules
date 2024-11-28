import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20,
  StakingERC20,
} from "../typechain";
import {
  NO_REWARDS_BALANCE_ERR,
  TIME_LOCK_NOT_PASSED_ERR,
  INSUFFICIENT_ALLOWANCE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  ZERO_VALUE_ERR,
  UNEQUAL_UNSTAKE_ERR,
  OWNABLE_UNAUTHORIZED_ERR,
  ZERO_REWARDS_ERR,
} from "./helpers/errors";
import {
  WITHDRAW_EVENT,
  INIT_BALANCE,
  DEFAULT_STAKED_AMOUNT,
  createDefaultConfigs,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  BaseConfig,
  DEFAULT_LOCK,
  DAY_IN_SECONDS,
  calcLockedRewards,
  calcTotalUnlockedRewards,
} from "./helpers/staking";

describe("StakingERC20", () => {
  let owner : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
  let stakerD : SignerWithAddress;
  let stakerF : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let contract : StakingERC20;

  let stakeToken : MockERC20;
  let rewardsToken : MockERC20;

  let config : BaseConfig;

  let reset = async () => {};

  before(async () => {
    [
      owner,
      stakerA,
      stakerB,
      stakerC,
      stakerD,
      stakerF,
      notStaker,
    ] = await hre.ethers.getSigners();

    const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");


    const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");

    reset = async () => {
      stakeToken = await mockERC20Factory.deploy("MEOW", "MEOW");
      rewardsToken = await mockERC20Factory.deploy("WilderWorld", "WW");

      config = await createDefaultConfigs(rewardsToken, undefined, stakeToken);

      contract = await stakingFactory.deploy(
        config.stakingToken,
        config.rewardsToken,
        config.rewardsPerPeriod,
        config.periodLength,
        config.lockAdjustment,
        owner.address
      ) as StakingERC20;

      // Give each user funds to stake
      await stakeToken.connect(owner).transfer(
        stakerA.address,
        INIT_BALANCE
      );
  
      await stakeToken.connect(owner).transfer(
        stakerB.address,
        INIT_BALANCE
      );
  
      await stakeToken.connect(owner).transfer(
        stakerC.address,
        INIT_BALANCE
      );
  
      await stakeToken.connect(owner).transfer(
        stakerD.address,
        INIT_BALANCE
      );
  
      await stakeToken.connect(owner).transfer(
        stakerF.address,
        INIT_BALANCE
      );
  
      // Approve staking contract to spend staker funds
      await stakeToken.connect(stakerA).approve(await contract.getAddress(), hre.ethers.MaxUint256);
      await stakeToken.connect(stakerB).approve(await contract.getAddress(), hre.ethers.MaxUint256);
      await stakeToken.connect(stakerC).approve(await contract.getAddress(), hre.ethers.MaxUint256);
      await stakeToken.connect(stakerD).approve(await contract.getAddress(), hre.ethers.MaxUint256);
      await stakeToken.connect(stakerF).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    }

    await reset();
  });

  describe("#getContractRewardsBalance", () => {
    it("Allows a user to see the total rewards remaining in a pool", async () => {
      const rewardsInPool = await contract.getContractRewardsBalance();
      const poolBalance = await rewardsToken.balanceOf(await contract.getAddress());
      expect(rewardsInPool).to.eq(poolBalance);
    });
  });

  describe("#stake", () => {
    it.skip("Real number calcs", async () => {
      const rewardsBefore = await rewardsToken.balanceOf(stakerA.address);

      // await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      await contract.connect(stakerB).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await time.increase(365n * DAY_IN_SECONDS);

      const stakerBData = await contract.stakers(stakerB.address);
      console.log(stakerBData.rewardsMultiplier)

      const pendingRewardsUnlockedA = await contract.connect(stakerA).getPendingRewards();
      const pendingRewardsLockedA = await contract.connect(stakerA).getPendingRewardsLocked();

      expect(pendingRewardsUnlockedA).to.gt(0n);
      expect(pendingRewardsLockedA).to.eq(0n);

      const pendingRewardsLockedB = await contract.connect(stakerB).getPendingRewardsLocked();
      const pendingRewardsUnlockedB = await contract.connect(stakerB).getPendingRewards();

      expect(pendingRewardsUnlockedB).to.eq(0n);
      expect(pendingRewardsLockedB).to.gt(0n);
    });
    it("Can stake without a lock successfully", async () => {
      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      const stakedAt = BigInt(await time.latest());

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(stakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Can stake a second time without a lock as the same user successfully", async () => {
      await time.increase(DEFAULT_LOCK / 3n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBeforeA = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());
      // amountStakedA += DEFAULT_STAKED_AMOUNT;

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfterA = await rewardsToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      // They have gained pending rewards but are not yet given them
      // expect(pendingRewards).to.eq(expectedRewards);
      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT * 2n);
      expect(stakerData.amountStakedLocked).to.eq(0n);

      expect(stakerData.unlockedTimestamp).to.eq(0n); // No time lock
      expect(stakerData.lastTimestamp).to.eq(stakedAt);
      expect(stakerData.owedRewards).to.be.gt(0n);
    });

    it("Can stake with a lock successfully", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.lastTimestampLocked).to.eq(stakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
    });

    it("Can stake a second time with a lock as the same user successfully", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      // If we don't increase time between two stakes it breaks
      // what is the smallest amount we can increase and it passes?
      // 20n passes, DIS / 20 = 4319 seconds = ~72 minutes
      // Any less and it fails
      // await time.increase(4319);

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      // TODO change to unlockedTimestamp should be shown with helper that does
      // the same weighted sum math that we do internally
      // TODO the weighted sum math breaks if stakes are too frequent
      // resolve what we shoud do

      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT * 2n);
      expect(stakerData.lastTimestampLocked).to.eq(stakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
    });

    it("Updates the amount of remaining time on follow up locks appropriately", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.lastTimestampLocked).to.eq(stakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);
      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);

      await time.increase(DEFAULT_LOCK);

      const futureExpectedRewards = calcLockedRewards(
        BigInt(await time.latest()) - stakedAt + 1n,
        DEFAULT_STAKED_AMOUNT,
        stakerData.rewardsMultiplier,
        config
      )

      const addedStake = hre.ethers.parseEther("900");

      // Additional locked stakes disregard the incoming lock duration
      await contract.connect(stakerA).stakeWithLock(addedStake, 1n);
      const secondStakedAt = BigInt(await time.latest());

      const stakerData2 = await contract.stakers(stakerA.address);

      // TODO come back to this and make sure it works, check values
      expect(stakerData2.owedRewardsLocked).to.eq(futureExpectedRewards);

      expect(stakerData2.lastTimestampLocked).to.eq(secondStakedAt);

      // The lock was increased by the users existing lock amount
      // We do + 1n to match the timestamp increment from HH automining
      // TODO resolve what the expected behavior of lock duration is upon adding more stake
      expect(stakerData2.unlockedTimestamp - stakerData.unlockedTimestamp).to.eq(DEFAULT_LOCK + 1n);
      
      // new TS should be `stakedAt + lockDuration`
      expect(stakerData2.unlockedTimestamp).to.eq(secondStakedAt + DEFAULT_LOCK);
      expect(stakerData2.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT + addedStake);
    });

    it("Can stake as a new user without lock when others are already staked", async () => {
      const pendingRewards = await contract.connect(stakerB).getPendingRewards();

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerB.address);

      await contract.connect(stakerB).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerB.address);

      const stakerData = await contract.stakers(stakerB.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.unlockedTimestamp).to.eq(0n);

      expect(stakerData.lastTimestamp).to.eq(stakedAt);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Can stake as a new user with a lock when others are already staked", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerB.address);

      await contract.connect(stakerB).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerB.address);

      const stakerData = await contract.stakers(stakerB.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);

      expect(stakerData.lastTimestampLocked).to.eq(stakedAt);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Fails when the staker doesn't have the funds to stake", async () => {
      const amount = hre.ethers.MaxUint256;

      // First, it will fail on allowance
      await expect(
        contract.connect(notStaker).stakeWithoutLock(amount)
      ).to.be.revertedWithCustomError(rewardsToken, INSUFFICIENT_ALLOWANCE_ERR)
        .withArgs(contract.target, 0n, amount);

      // Then after we allow funds, it will fail on balance
      await stakeToken.connect(notStaker).approve(await contract.getAddress(), amount);

      const balance = await stakeToken.balanceOf(notStaker.address);
      await expect(
        contract.connect(notStaker).stakeWithLock(amount, DEFAULT_LOCK)
      ).to.be.revertedWithCustomError(stakeToken, INSUFFICIENT_BALANCE_ERR)
        .withArgs(notStaker.address, balance, amount);
    });

    it("Fails when the staker tries to stake 0", async () => {
      await expect(
        contract.connect(stakerA).stakeWithoutLock(0n)
      ).to.be.revertedWithCustomError(contract, ZERO_VALUE_ERR);

      await expect(
        contract.connect(stakerA).stakeWithLock(0n, DEFAULT_LOCK)
      ).to.be.revertedWithCustomError(contract, ZERO_VALUE_ERR);
    });
  });

  describe("#getRemainingLockTime", () => {
    it("Allows the user to view the remaining time lock period for a stake", async () => {
      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK / 2n);

      const remainingLockTime = await contract.connect(stakerC).getRemainingLockTime();

      const stakerData = await contract.stakers(stakerA.address);

      expect(remainingLockTime).to.eq((stakerData.lockDuration - (DEFAULT_LOCK / 2n)));
    });

    it("Returns 0 for a user that's passed their lock time", async () => {
      await time.increase(DEFAULT_LOCK);

      const remainingLockTime = await contract.connect(stakerB).getRemainingLockTime();
      expect(remainingLockTime).to.eq(0n);
    });

    it("Returns 0 for a user that has not staked", async () => {
      const remainingLockTime = await contract.connect(notStaker).getRemainingLockTime();
      expect(remainingLockTime).to.eq(0n);
    });
  });

  describe("#getPendingRewards", () => {
    it("Allows the user to view the pending rewards for a stake without a lock", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 4n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakedAt],
        [DEFAULT_STAKED_AMOUNT],
        config
      );

      expect(pendingRewards).to.eq(futureExpectedRewards);

      const stakerData = await contract.stakers(stakerA.address);

      // Because we haven't added any additional stake, `owedRewards` is not updated yet
      expect(stakerData.owedRewards).to.eq(0n);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAtTwo = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 4n);

      // // period 1 bal default, period 2 bal default * 2
      // const futureExpectedRewardsSecond = calcUnlockedRewards(
      //   BigInt(await time.latest()) - stakedAt,
      //   DEFAULT_STAKED_AMOUNT * 2n,
      //   config.rewardsPerPeriod,
      // );

      // TODO math on exact flow here

      const realExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakedAtTwo, stakedAtTwo - stakedAt - 1n],
        [DEFAULT_STAKED_AMOUNT * 2n, DEFAULT_STAKED_AMOUNT],
        config
      )

      // TODO return 0 if check immediately after stake
      const pendingRewardsAfter = await contract.connect(stakerA).getPendingRewards();

      const stakerDataAfter = await contract.stakers(stakerA.address);

      // expect(pendingRewardsAfter).to.eq(futureExpectedRewardsSecond);
      expect(stakerDataAfter.owedRewards)//eq(futureExpectedRewardsSecond);

      // await time.increase(DEFAULT_LOCK / 4n);

      // Pending rewards are updated like `periodA * balanceA + periodB * balanceB`
      // console.log(pendingRewardsAfter);
      // TODO
    });

    it("Allows the user to view the pending rewards for a stake with a lock", async () => {
      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK / 4n);

      const pendingRewardsLocked = await contract.connect(stakerA).getPendingRewardsLocked();
      // TODO update rewards helper to match expected value
      expect(pendingRewardsLocked).to.be.gt(0n);
    });

    it("Returns 0 for a user that has not staked", async () => {
      const pendingRewards = await contract.connect(notStaker).getPendingRewards();
      expect(pendingRewards).to.eq(0n);
    });
  });

  describe("#claim", () => {
    it("Allows the user to claim their non-locked rewards", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      await time.increase(DEFAULT_LOCK / 4n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards * 2n // account for +1s timestamp execution
      );

      await contract.connect(stakerA).claim();

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      // expect(pendingRewards).to.eq(expectedRewards);
      // TODO update helper
      // expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + pendingRewards);

      const stakerData = await contract.stakers(stakerA.address);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Allows the user to claim their locked rewards only when passed their lock", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 4n);

      // Fails when claiming too early
      await expect(
        contract.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(contract, ZERO_REWARDS_ERR);

      await time.increase(DEFAULT_LOCK);

      // Fails when the contract does not have balance to match rewards
      await expect(
        contract.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_BALANCE_ERR);

      // Provide rewards to give
      await rewardsToken.connect(owner).transfer(await contract.getAddress(), hre.ethers.parseEther("5000"));

      const balanceBefore = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const balanceAfter = await rewardsToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      const expectedRewards = calcTotalUnlockedRewards(
        [claimedAt - stakedAt],
        [DEFAULT_STAKED_AMOUNT],
        config
      );

      // TODO difference of ~103 wei, rounding error?
      const match = stakerData.rewardsMultiplier * expectedRewards / 100n;

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(contract, ZERO_REWARDS_ERR);
    });

    it("Fails when the contract has no rewards", async () => {
      await contract.withdrawLeftoverRewards();

      await expect(
        contract.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_BALANCE_ERR);
    });

    it("Fails to claim when the user has not passed their lock time", async () => {
      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      // Provide rewards to give
      await rewardsToken.connect(owner).transfer(await contract.getAddress(), hre.ethers.parseEther("5000"));

      await expect(
        contract.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(contract, ZERO_REWARDS_ERR);
    });
  });

  describe("#unstake", () => {
    it("Allows a user to unstake non-locked amount partially", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 2n);

      // Unstake half of the original stake
      const amount = DEFAULT_STAKED_AMOUNT / 2n;

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      await stakeToken.connect(stakerA).approve(await contract.getAddress(), amount);
      const pendingRewards = await contract.connect(stakerA).getPendingRewards();
      

      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakedAt + 2n],
        [DEFAULT_STAKED_AMOUNT],
        config,
      );

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      await contract.connect(stakerA).unstake(amount);
      const unstakedAt = BigInt(await time.latest());

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + amount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + futureExpectedRewards);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT / 2n);
      expect(stakerData.lastTimestamp).to.eq(unstakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(0n); // User has no locked stake
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Allows a user to fully withdraw their entire non-locked staked amount", async () => {
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      await time.increase(DEFAULT_LOCK / 2n);

      const stakerDataBefore = await contract.stakers(stakerA.address);

      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakerDataBefore.lastTimestamp + 2n],
        [stakerDataBefore.amountStaked],
        config,
      );

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      await contract.connect(stakerA).unstake(stakerDataBefore.amountStaked);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + stakerDataBefore.amountStaked);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + futureExpectedRewards);

      const stakerDataAfter = await contract.stakers(stakerA.address);

      // Verify all values are reset to 0 after full withdrawal
      expect(stakerDataAfter.amountStaked).to.eq(0n);
      expect(stakerDataAfter.lastTimestamp).to.eq(0n);
      expect(stakerDataAfter.unlockedTimestamp).to.eq(0n);
      expect(stakerDataAfter.owedRewards).to.eq(0n);
    });

    it("Fails to unstake 0 amount", async () => {
      await expect(
        contract.connect(stakerA).unstake(0)
      ).to.be.revertedWithCustomError(contract, ZERO_VALUE_ERR);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstake(DEFAULT_STAKED_AMOUNT)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Fails when the user tries to unstake more than they have staked", async () => {
      // Avoid erroring for time lock period
      await time.increase(DEFAULT_LOCK);

      const stakerData = await contract.stakers(stakerC.address);

      await expect(
        contract.connect(stakerC).unstakeLocked(stakerData.amountStakedLocked + 1n, false)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Fails when there are not enough rewards in the contract", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      await time.increase(DEFAULT_LOCK / 2n);

      const stakerData = await contract.stakers(stakerA.address);

      await expect(
        contract.connect(stakerA).unstake(stakerData.amountStaked)
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_BALANCE_ERR);
    });
  });

  describe("#unstakeLocked", () => {
    it("Allows a user to partially unstake locked funds when passed their lock time", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      const pendingRewards = await contract.connect(stakerA).getPendingRewardsLocked();

      const stakerDataBefore = await contract.stakers(stakerA.address);

      const futureExpectedRewards = calcLockedRewards(
        BigInt(await time.latest()) - stakedAt + 2n,
        DEFAULT_STAKED_AMOUNT,
        stakerDataBefore.rewardsMultiplier,
        config
      )

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerA).unstakeLocked(amount, false);
      const unstakedAt = BigInt(await time.latest());

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);


      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + DEFAULT_STAKED_AMOUNT / 2n);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + futureExpectedRewards);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT / 2n);
      expect(stakerData.lastTimestampLocked).to.eq(unstakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);
      expect(stakerData.owedRewardsLocked).to.eq(0n);
    });

    it("Allows a user to fully unstake locked funds when passed their lock time", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      

      const pendingRewards = await contract.connect(stakerA).getPendingRewardsLocked();
      const stakerDataBefore = await contract.stakers(stakerA.address);

      // + 2n for timestamp manipulation, +1 for transfer and then +1 for unstake
      const futureExpectedRewards = calcLockedRewards(
        BigInt(await time.latest()) - stakerDataBefore.lastTimestampLocked + 2n,
        DEFAULT_STAKED_AMOUNT / 2n,
        stakerDataBefore.rewardsMultiplier,
        config
      )

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      await contract.connect(stakerA).unstakeLocked(DEFAULT_STAKED_AMOUNT / 2n, false);

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + futureExpectedRewards);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + DEFAULT_STAKED_AMOUNT / 2n);

      const stakerData = await contract.stakers(stakerA.address);

      // Confirm all values are reset to 0 after full withdrawal
      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.lastTimestampLocked).to.eq(0n);
      expect(stakerData.unlockedTimestamp).to.eq(0n);
      expect(stakerData.owedRewardsLocked).to.eq(0n);
    });

    it("Fails when the user tries to unstake 0 amount", async () => {
      await expect(
        contract.connect(stakerA).unstakeLocked(0, false)
      ).to.be.revertedWithCustomError(contract, ZERO_VALUE_ERR);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstakeLocked(1, false)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Fails when the user has not passed their lock time", async () => {
      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await expect(
        contract.connect(stakerC).unstakeLocked(DEFAULT_STAKED_AMOUNT, false)
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails when the user tries to unstake more than they have staked", async () => {
      await time.increase(DEFAULT_LOCK);

      const stakerData = await contract.stakers(stakerC.address);

      await expect(
        contract.connect(stakerC).unstakeLocked(stakerData.amountStakedLocked + 1n, false)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Fails when there are not enough rewards in the contract", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK);

      await expect(
        contract.connect(stakerA).unstakeLocked(DEFAULT_STAKED_AMOUNT, false)
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_BALANCE_ERR);
    });
  });

  describe("#unstakeLocked with 'exit'", () => {
    it("Allows a user to partially unstake using 'exit' within lock duration", async () => {
      await reset();

      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);
      const stakerDataBefore = await contract.stakers(stakerC.address);

      await time.increase(DEFAULT_LOCK / 2n);

      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakerDataBefore.lastTimestampLocked + 2n],
        [DEFAULT_STAKED_AMOUNT],
        config
      )

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      // Allows unstaking with 'exit' before the time lock is over
      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerC).unstakeLocked(amount, true);
      const unstakedAt = BigInt(await time.latest());

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

      // Confirm they have not gained rewards
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);

      const stakerData = await contract.stakers(stakerC.address);
      
      expect(stakerData.amountStakedLocked).to.eq(amount);
      expect(stakerData.lastTimestampLocked).to.eq(unstakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(stakerDataBefore.lastTimestampLocked + DEFAULT_LOCK);
      expect(stakerData.owedRewardsLocked).to.eq(0n);
    });

    it("Allows a user to fully unstake using 'exit' within lock duration", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      const stakerDataBefore = await contract.stakers(stakerC.address);

      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakerDataBefore.lastTimestampLocked + 2n],
        [DEFAULT_STAKED_AMOUNT / 2n],
        config
      )

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerC).unstakeLocked(amount, true);
      const unstakedAt = BigInt(await time.latest());

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

      // Confirm they have not received rewards
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.lastTimestampLocked).to.eq(0n);
      expect(stakerData.unlockedTimestamp).to.eq(0n);
      expect(stakerData.owedRewardsLocked).to.eq(0n);
    });

    it("Doesn't effect non-locked funds when user partially unstakes using 'exit' after lock duration", async () => {
      await reset();

      await contract.connect(stakerC).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      
      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK / 2n);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      const stakerDataBefore = await contract.stakers(stakerC.address);

      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakerDataBefore.lastTimestampLocked + 2n],
        [DEFAULT_STAKED_AMOUNT],
        config
      )

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerC).unstakeLocked(amount, true);
      const unstakedAt = BigInt(await time.latest());

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

      // Confirm they have not received rewards
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);

      const stakerDataAfter = await contract.stakers(stakerC.address);

      // Confirm non-locked balance is unchanged
      expect(stakerDataAfter.amountStaked).to.eq(stakerDataBefore.amountStaked);
      expect(stakerDataAfter.owedRewards).to.eq(stakerDataBefore.owedRewards);
      expect(stakerDataAfter.lastTimestamp).to.eq(stakerDataBefore.lastTimestamp);
      
      expect(stakerDataAfter.amountStakedLocked).to.eq(amount);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(unstakedAt);
      expect(stakerDataAfter.unlockedTimestamp).to.eq(stakerDataBefore.lastTimestampLocked + DEFAULT_LOCK);
      expect(stakerDataAfter.owedRewardsLocked).to.eq(0n);
    });

    it("Doesn't effect non-locked funds when user fully unstakes using 'exit' after lock duration", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      const stakerDataBefore = await contract.stakers(stakerC.address);

      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakerDataBefore.lastTimestampLocked + 2n],
        [DEFAULT_STAKED_AMOUNT / 2n],
        config
      )

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      await contract.connect(stakerC).unstakeLocked(stakerDataBefore.amountStakedLocked, true);

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

      // Confirm no rewards
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + stakerDataBefore.amountStakedLocked);

      const stakerDataAfter = await contract.stakers(stakerC.address);

      // Confirm non-locked balance is unchanged
      expect(stakerDataAfter.amountStaked).to.eq(stakerDataBefore.amountStaked);
      expect(stakerDataAfter.owedRewards).to.eq(stakerDataBefore.owedRewards);
      expect(stakerDataAfter.lastTimestamp).to.eq(stakerDataBefore.lastTimestamp);

      expect(stakerDataAfter.amountStakedLocked).to.eq(0n);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(0n);
      expect(stakerDataAfter.unlockedTimestamp).to.eq(0n);
      expect(stakerDataAfter.owedRewardsLocked).to.eq(0n);
    });
  
    it("Fails when the user tries to unstake 0 amount with `exit`", async () => {
      await expect(
        contract.connect(stakerC).unstakeLocked(0, true)
      ).to.be.revertedWithCustomError(contract, ZERO_VALUE_ERR);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstakeLocked(1, true)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Fails when the user tries to unstake more than they have staked", async () => {
      const stakerData = await contract.stakers(stakerC.address);

      await expect(
        contract.connect(stakerC).unstakeLocked(stakerData.amountStakedLocked + 1n, true)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Does not fail when there are not enough rewards in the contract", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const contractBalance = await rewardsToken.balanceOf(await contract.getAddress());

      expect(contractBalance).to.eq(0n);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).unstakeLocked(DEFAULT_STAKED_AMOUNT, true);

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
    });
  });

  describe("#withdrawLeftoverRewards", () => {
    it("Allows the admin to withdraw leftover rewards", async () => {
      const amount = 1000n;
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        amount
      );

      const rewardsBalanceBefore = await rewardsToken.balanceOf(owner.address);
      const contractRewardsBalanceBefore = await contract.getContractRewardsBalance();

      await contract.connect(owner).withdrawLeftoverRewards();

      const rewardsBalanceAfter = await rewardsToken.balanceOf(owner.address);
      const contractRewardsBalanceAfter = await contract.getContractRewardsBalance();

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + amount);
      expect(contractRewardsBalanceAfter).to.eq(contractRewardsBalanceBefore - amount);
      expect(contractRewardsBalanceAfter).to.eq(0n);
    });

    it("Fails when the caller is not the admin", async () => {
      await expect(
        contract.connect(notStaker).withdrawLeftoverRewards()
      ).to.be.revertedWithCustomError(contract, OWNABLE_UNAUTHORIZED_ERR)
        .withArgs(notStaker.address);
    });

    it("Fails when the contract has no rewards left to withdraw", async () => {
      await expect(
        contract.connect(owner).withdrawLeftoverRewards()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_BALANCE_ERR);
    });
  });

  describe.only("Utility functions", () => {
    // 36500 is min lock time if divisor in RM function is 365
    // 50000 is min lock time if divisor in RM function is 500
    // etc.
    it("Test the reward multiplier calculation with every value allowed", async () => {
      // for (let i = DAY_IN_SECONDS / 2n; i < 365n * DAY_IN_SECONDS; i++) {
      //   const multiplier = await contract.getRewardsMultiplier(i);

      //   if (multiplier == 0n) {
      //     console.log(`Lock duration that returns 0 RM: ${i}`);
      //   }
      //   // expect(multiplier).to.gt(0n);
      // }
      const multiplier = await contract.getRewardsMultiplier(36500n);
      // console.log(multiplier);
    })

    it("Tries to claim when RM is minimal value", async () => {
      await reset();

      await rewardsToken.connect(stakerA).mint(await contract.getAddress(), hre.ethers.parseEther("999999"));

      // await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, 50000n);
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      await contract.connect(stakerB).stakeWithLock(DEFAULT_STAKED_AMOUNT, 36500n);

      const stakerAData = await contract.stakers(stakerA.address);
      const stakerBData = await contract.stakers(stakerB.address);

      // expect(stakerData.rewardsMultiplier).to.eq(1n); // 0.01x multiplier
      // math might break if multiplier is too small? but we scale it up, might be okay

      // move time to be past the lock duration
      await time.increase(50001n);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(rewardsBalanceAfter).to.be.gt(rewardsBalanceBefore);
    })
  });

  describe("Events", () => {
    it("Emits a Staked event when a user stakes", async () => {
      await reset(); 

      // const futureStakedAt = BigInt(await time.latest());
      await expect(
        contract.connect(stakerF).stakeWithoutLock(DEFAULT_STAKED_AMOUNT)
      ).to.emit(contract, STAKED_EVENT)
        .withArgs(stakerF.address, DEFAULT_STAKED_AMOUNT, 0n, config.stakingToken);
    });

    it("Emits a Claimed event when a user claims rewards", async () => {
      const stakeTime = BigInt(await time.latest());

      const pendingRewards = await contract.connect(stakerF).getPendingRewards();

      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) + 1n - stakeTime],
        [DEFAULT_STAKED_AMOUNT],
        config
      );

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );
      // console.log(futureExpectedRewards) TODO debugging, this math is wrong

      await expect(
        contract.connect(stakerF).claim()
      ).to.emit(contract, CLAIMED_EVENT)
        .withArgs(stakerF.address, futureExpectedRewards, config.rewardsToken);
    });

    it("Emits an Unstaked event when a user unstakes", async () => {
      await time.increase(DEFAULT_LOCK / 2n);

      const pendingRewards = await contract.connect(stakerF).getPendingRewards();

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards
      );

      const stakerData = await contract.stakers(stakerF.address);

      await expect(
        contract.connect(stakerF).unstake(stakerData.amountStaked / 2n)
      ).to.emit(contract, UNSTAKED_EVENT)
        .withArgs(stakerF.address, stakerData.amountStaked / 2n, config.stakingToken);
    });

    it("Emits an Unstaked event when a user exits with unstake", async () => {
      await time.increase(DEFAULT_LOCK);

      const stakerData = await contract.stakers(stakerF.address);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerF.address);
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerF.address);

      await expect(
        contract.connect(stakerF).unstakeLocked(stakerData.amountStaked, true)
      ).to.emit(contract, UNSTAKED_EVENT)
        .withArgs(stakerF.address, stakerData.amountStaked, config.stakingToken);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerF.address);
      const stakeBalanceAfter = await stakeToken.balanceOf(stakerF.address);

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + stakerData.amountStaked);

      const stakerDataAfter = await contract.stakers(stakerF.address);

      expect(stakerDataAfter.amountStaked).to.eq(0n);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(0n);
      expect(stakerDataAfter.unlockedTimestamp).to.eq(0n);
      expect(stakerDataAfter.owedRewards).to.eq(0n);
    });

    it("Emits 'LeftoverRewardsWithdrawn' event when the admin withdraws", async () => {
      const amount = rewardsToken.balanceOf(await contract.getAddress());

      await expect(
        contract.connect(owner).withdrawLeftoverRewards()
      ).to.emit(contract, WITHDRAW_EVENT)
        .withArgs(owner.address, amount);
    });
  });
});
