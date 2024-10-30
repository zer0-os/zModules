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
  ZERO_STAKE_ERR,
  UNEQUAL_UNSTAKE_ERR,
  OWNABLE_UNAUTHORIZED_ERR,
  NO_REWARDS_ERR,
} from "./helpers/errors";
import {
  WITHDRAW_EVENT,
  INIT_BALANCE,
  DEFAULT_STAKED_AMOUNT,
  createDefaultConfigs,
  calcTotalRewards,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  BaseConfig,
  DEFAULT_LOCK,
  DAY_IN_SECONDS,
  calcUnlockedRewards,
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

  // We don't use `PoolConfig` anymore on the contracts but for convenience in testing
  // we can leave this type where it is
  let config : BaseConfig;

  // Track first stake and most recent stake times
  let origStakedAtA : bigint;
  let stakedAtA :  bigint;

  let origStakedAtB : bigint;
  let stakedAtB : bigint;

  let origStakedAtC : bigint;
  let stakedAtC : bigint;

  let origStakedAtD : bigint;
  let stakedAtD : bigint;

  // Set initial values for stakers
  let amountStakedA = 0n;
  let amountStakedLockedA = 0n;
  let amountStakedB = 0n;
  let amountStakedLockedB = 0n;
  let amountStakedC = 0n;
  let amountStakedLockedC = 0n;

  let claimedAtA : bigint;

  let unstakedAtA : bigint;
  let unstakedAtC : bigint;

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

  describe.only("#stake", () => {
    it("Can stake without a lock successfully", async () => {
      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      stakedAtA = BigInt(await time.latest());
      origStakedAtA = stakedAtA;

      amountStakedA = DEFAULT_STAKED_AMOUNT;

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(stakedAtA);
      expect(stakerData.unlockedTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Can stake a second time without a lock as the same user successfully", async () => {
      await time.increase(DEFAULT_LOCK / 3n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBeforeA = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      stakedAtA = BigInt(await time.latest());
      amountStakedA += DEFAULT_STAKED_AMOUNT;

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
      expect(stakerData.lastTimestamp).to.eq(stakedAtA);
      expect(stakerData.owedRewards).to.be.gt(0n);
    });

    it("Can stake with a lock successfully", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      stakedAtA = BigInt(await time.latest());
      amountStakedA += DEFAULT_STAKED_AMOUNT;

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.lastTimestampLocked).to.eq(stakedAtA);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAtA + DEFAULT_LOCK);
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
      stakedAtA = BigInt(await time.latest());
      amountStakedA += DEFAULT_STAKED_AMOUNT;

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      // TODO change to unlockedTimestamp should be shown with helper that does
      // the same weighted sum math that we do internally
      // TODO the weighted sum math breaks if stakes are too frequent
      // resolve what we shoud do

      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT * 2n);
      expect(stakerData.lastTimestampLocked).to.eq(stakedAtA);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAtA + DEFAULT_LOCK); // TODO impl lock period change
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
    });

    it("Updates the amount of remaining time on follow up locks appropriately", async () => {
      await reset();
      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      stakedAtA = BigInt(await time.latest());
      amountStakedLockedA = DEFAULT_STAKED_AMOUNT;

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.lastTimestampLocked).to.eq(stakedAtA);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAtA + DEFAULT_LOCK);
      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);

      await time.increase(DEFAULT_LOCK / 4n);

      const stakeAdded = hre.ethers.parseEther("900");
      await contract.connect(stakerA).stakeWithLock(stakeAdded, 1n);
      stakedAtA = BigInt(await time.latest());
      amountStakedLockedA += DEFAULT_STAKED_AMOUNT;

      const stakerData2 = await contract.stakers(stakerA.address);

      expect(stakerData2.lastTimestampLocked).to.eq(stakedAtA);

      // TODO add helper function that calcs the same to compare to
      expect(stakerData2.unlockedTimestamp).to.gt(stakerData.unlockedTimestamp);
      expect(stakerData2.unlockedTimestamp).to.eq(stakedAtA + DEFAULT_LOCK);
      expect(stakerData2.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT + stakeAdded);
    });

    it("Can stake as a new user without lock when others are already staked", async () => {
      const pendingRewards = await contract.connect(stakerB).getPendingRewards();

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerB.address);

      await contract.connect(stakerB).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      stakedAtB = BigInt(await time.latest());
      amountStakedB += DEFAULT_STAKED_AMOUNT;
      origStakedAtB = stakedAtB;

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerB.address);

      const stakerData = await contract.stakers(stakerB.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.unlockedTimestamp).to.eq(0n);

      expect(stakerData.lastTimestamp).to.eq(stakedAtB);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Can stake as a new user with a lock when others are already staked", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerB.address);

      await contract.connect(stakerB).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      stakedAtB = BigInt(await time.latest());
      amountStakedLockedB += DEFAULT_STAKED_AMOUNT;

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerB.address);

      const stakerData = await contract.stakers(stakerB.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAtB + DEFAULT_LOCK);

      expect(stakerData.lastTimestampLocked).to.eq(stakedAtB);
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
      ).to.be.revertedWithCustomError(contract, ZERO_STAKE_ERR);

      await expect(
        contract.connect(stakerA).stakeWithLock(0n, DEFAULT_LOCK)
      ).to.be.revertedWithCustomError(contract, ZERO_STAKE_ERR);
    });
  });

  describe.only("#getRemainingLockTime", () => {
    it("Allows the user to view the remaining time lock period for a stake", async () => {
      const remainingLockTime = await contract.connect(stakerB).getRemainingLockTime();
      const latest = await time.latest();

      const stakeData = await contract.stakers(stakerA.address);

      // We do -3n to match the time changes from the above failing cases since previous stake
      expect(remainingLockTime).to.eq((stakeData.unlockedTimestamp - BigInt(stakedAtB) - 3n));
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

  describe.only("#getPendingRewards", () => {
    it("Allows the user to view the pending rewards for a stake without a lock", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      await time.increase(DEFAULT_LOCK / 4n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      // TODO add help expected value when updated
      expect(pendingRewards).to.be.gt(0n);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      
      // Confirm owed rewards upon second stake are snapshotted based
      // on balance for previous period
      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.owedRewards).to.be.gt(0n);

      await time.increase(DEFAULT_LOCK / 4n);

      const pendingRewardsAfter = await contract.connect(stakerA).getPendingRewards();
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

  describe.only("#claim", () => {
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

      // console.log("before-ts: ", await time.latest())

      await contract.connect(stakerA).claim();
      claimedAtA = BigInt(await time.latest());

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

      // Fails when the contract does not have balance to match rewards
      await expect(
        contract.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_BALANCE_ERR);

      // Provide rewards to give
      await rewardsToken.connect(owner).transfer(await contract.getAddress(), hre.ethers.parseEther("5000"));

      // Fails when claiming too early
      await expect(
        contract.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_ERR);

      await time.increase(DEFAULT_LOCK);

      const balanceBefore = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const balanceAfter = await rewardsToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      const expectedRewards = calcUnlockedRewards(
        claimedAt - stakedAt,
        DEFAULT_STAKED_AMOUNT,
        config.rewardsPerPeriod
      );

      // TODO difference of ~103 wei, rounding error?
      const match = stakerData.rewardsMultiplier * expectedRewards / 100n;

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_ERR);
    });

    it("Fails when the contract has no rewards", async () => {
      // call to claim without first transferring rewards to the contract
      // No rewards left
      await contract.connect(owner).withdrawLeftoverRewards();

      await expect(
        contract.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_BALANCE_ERR);
    });

    it("Fails when the user has not passed their lock time", async () => {
      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      // Provide rewards to give
      await rewardsToken.connect(owner).transfer(await contract.getAddress(), hre.ethers.parseEther("5000"));

      await expect(
        contract.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    });
  });

  describe("#unstake", () => {
    it("Allows a user to unstake partially", async () => {
      await time.increase(config.periodLength * 7n);

      // Unstake half of the original stake
      const amount = amountStakedA / 2n;
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards
      );

      await stakeToken.connect(stakerA).approve(await contract.getAddress(), amount);

      await contract.connect(stakerA).unstake(amount, false);
      unstakedAtA = BigInt(await time.latest());

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      const expectedRewards = calcTotalRewards(
        [unstakedAtA - claimedAtA],
        [amountStakedA],
        config.rewardsPerPeriod,
        config.periodLength
      );

      expect(pendingRewards).to.eq(expectedRewards);
      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + amount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + pendingRewards);

      const stakerData = await contract.stakers(stakerA.address);
      expect(stakerData.amountStaked).to.eq(amountStakedA - amount);
      expect(stakerData.lastUpdatedTimestamp).to.eq(unstakedAtA);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtA + config.timeLockPeriod);
      expect(stakerData.owedRewards).to.eq(0n);

      // Update the amount the user has left staked in the contract
      amountStakedA -= amount;
    });

    it("Allows a user to fully withdraw their entire staked amount", async () => {
      await time.increase(config.periodLength * 11n);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards
      );

      await contract.connect(stakerA).unstake(amountStakedA, false);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      const expectedRewards = calcTotalRewards(
        [BigInt(await time.latest()) - unstakedAtA],
        [amountStakedA],
        config.rewardsPerPeriod,
        config.periodLength
      );

      unstakedAtA = BigInt(await time.latest());

      expect(pendingRewards).to.eq(expectedRewards);
      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + amountStakedA);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + pendingRewards);

      const stakerData = await contract.stakers(stakerA.address);

      // Verify all values are reset to 0 after full withdrawal
      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerData.unlockTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstake(DEFAULT_STAKED_AMOUNT, false)
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails when the user has not passed their lock time", async () => {
      await contract.connect(stakerC).stake(DEFAULT_STAKED_AMOUNT);
      origStakedAtC = BigInt(await time.latest());
      stakedAtC = origStakedAtC;

      const pendingRewards = await contract.connect(stakerC).getPendingRewards();

      // Restaking for the first time, do not add to old value
      amountStakedC = DEFAULT_STAKED_AMOUNT;

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.unlockTimestamp).to.eq(origStakedAtC + config.timeLockPeriod);
      expect(stakerData.amountStaked).to.eq(amountStakedC);
      expect(stakerData.owedRewards).to.eq(pendingRewards);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtC);

      // Fail to unstake with rewards when not passed time lock period
      await expect(
        contract.connect(stakerC).unstake(DEFAULT_STAKED_AMOUNT, false)
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails when the user tries to unstake more than they have staked", async () => {
      // Avoid erroring for time lock period
      await time.increase(config.timeLockPeriod);

      await expect(
        contract.connect(stakerC).unstake(amountStakedC + 1n, false)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });
  });

  describe("#unstake with 'exit'", () => {
    it("Allows a user to partially unstake without rewards using 'exit'", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      await time.increase(config.periodLength * 2n);

      const pendingRewards = await contract.connect(stakerC).getPendingRewards();

      // Allows unstaking with 'exit' before the time lock is over
      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerC).unstake(amount, true);
      unstakedAtC = BigInt(await time.latest());
      amountStakedC -= amount;

      const expectedRewards = calcTotalRewards(
        [unstakedAtC - origStakedAtC],
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

      // Confirm they have pending rewards but don't receive them
      expect(pendingRewards).to.eq(expectedRewards);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.amountStaked).to.eq(amount);
      expect(stakerData.lastUpdatedTimestamp).to.eq(unstakedAtC);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtC + config.timeLockPeriod);
      expect(stakerData.owedRewards).to.eq(pendingRewards);
    });

    it("Allows a user to fully unstake without rewards using 'exit'", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      const pendingRewards = await contract.connect(stakerC).getPendingRewards();

      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerC).unstake(amount, true);

      const timestamp = BigInt(await time.latest());

      const expectedRewards = calcTotalRewards(
        [timestamp - unstakedAtC, unstakedAtC - stakedAtC],
        [DEFAULT_STAKED_AMOUNT / 2n, DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      unstakedAtC = BigInt(await time.latest());
      const stakeBalanceAfter = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

      // Confirm they have pending rewards but don't receive them
      expect(pendingRewards).to.eq(expectedRewards);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerData.unlockTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstake(1, true)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Succeeds when the user has not passed their lock time", async () => {
      await contract.connect(stakerC).stake(DEFAULT_STAKED_AMOUNT);
      stakedAtC = BigInt(await time.latest());

      // Fully withdrew stake previously, so expect a new unlock time
      origStakedAtC = stakedAtC;
      amountStakedC = DEFAULT_STAKED_AMOUNT;

      // unstake without rewards when not passed time lock period
      await contract.connect(stakerC).unstake(DEFAULT_STAKED_AMOUNT, true);

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.unlockTimestamp).to.eq(0n);
      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
      expect(stakerData.lastUpdatedTimestamp).to.eq(0n);
    });

    it("Fails when the user tries to unstake more than they have staked", async () => {
      await expect(
        contract.connect(stakerC).unstake(amountStakedC + 1n, true)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
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

  describe("Events", () => {
    it("Emits a Staked event when a user stakes", async () => {
      await expect(
        contract.connect(stakerF).stake(DEFAULT_STAKED_AMOUNT)
      ).to.emit(contract, STAKED_EVENT)
        .withArgs(stakerF.address, DEFAULT_STAKED_AMOUNT, config.stakingToken);
    });

    it("Emits a Claimed event when a user claims rewards", async () => {
      await time.increase(config.timeLockPeriod);

      const pendingRewards = await contract.connect(stakerF).getPendingRewards();

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards
      );

      await expect(
        contract.connect(stakerF).claim()
      ).to.emit(contract, CLAIMED_EVENT)
        .withArgs(stakerF.address, pendingRewards, config.rewardsToken);
    });

    it("Emits an Unstaked event when a user unstakes", async () => {
      await time.increase(config.periodLength * 3n);

      const pendingRewards = await contract.connect(stakerF).getPendingRewards();

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards
      );

      const stakerData = await contract.stakers(stakerF.address);

      await expect(
        contract.connect(stakerF).unstake(stakerData.amountStaked / 2n, false)
      ).to.emit(contract, UNSTAKED_EVENT)
        .withArgs(stakerF.address, stakerData.amountStaked / 2n, config.stakingToken);
    });

    it("Emits an Unstaked event when a user exits with unstake", async () => {
      await time.increase(config.periodLength * 7n);

      const stakerData = await contract.stakers(stakerF.address);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerF.address);
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerF.address);

      await expect(
        contract.connect(stakerF).unstake(stakerData.amountStaked, true)
      ).to.emit(contract, UNSTAKED_EVENT)
        .withArgs(stakerF.address, stakerData.amountStaked, config.stakingToken);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerF.address);
      const stakeBalanceAfter = await stakeToken.balanceOf(stakerF.address);

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + stakerData.amountStaked);

      const stakerDataAfter = await contract.stakers(stakerF.address);

      expect(stakerDataAfter.amountStaked).to.eq(0n);
      expect(stakerDataAfter.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerDataAfter.unlockTimestamp).to.eq(0n);
      expect(stakerDataAfter.owedRewards).to.eq(0n);
    });

    it("Emits 'LeftoverRewardsWithdrawn' event when the admin withdraws", async () => {
      const amount = 1000n;
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        amount
      );

      await expect(
        contract.connect(owner).withdrawLeftoverRewards()
      ).to.emit(contract, WITHDRAW_EVENT)
        .withArgs(owner.address, amount);
    });
  });
});
