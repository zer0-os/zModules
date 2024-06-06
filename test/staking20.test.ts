import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  DeflERC20Mock,
  MockERC20,
  StakingERC20, StakingERC20__factory,
} from "../typechain";
import {
  NO_REWARDS_ERR,
  TIME_LOCK_NOT_PASSED_ERR,
  INSUFFICIENT_ALLOWANCE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  ZERO_STAKE_ERR,
  UNEQUAL_UNSTAKE_ERR,
  OWNABLE_UNAUTHORIZED_ERR, ZERO_UNSTAKE_ERR,
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
} from "./helpers/staking";
import { ethers } from "ethers";


describe("StakingERC20", () => {
  let owner : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
  let stakerD : SignerWithAddress;
  let stakerF : SignerWithAddress;
  let notStaker : SignerWithAddress;
  let edgeStaker : SignerWithAddress;

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
  let amountStakedC = 0n;

  let claimedAtA : bigint;

  let unstakedAtA : bigint;
  let unstakedAtC : bigint;

  let stakingFactory : StakingERC20__factory;

  before(async () => {
    [
      owner,
      stakerA,
      stakerB,
      stakerC,
      stakerD,
      stakerF,
      notStaker,
      edgeStaker,
    ] = await hre.ethers.getSigners();

    const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    stakeToken = await mockERC20Factory.deploy("MEOW", "MEOW");

    rewardsToken = await mockERC20Factory.deploy("WilderWorld", "WW");

    config = await createDefaultConfigs(rewardsToken, undefined, stakeToken);

    stakingFactory = await hre.ethers.getContractFactory("StakingERC20");

    contract = await stakingFactory.deploy(
      config.stakingToken,
      config.rewardsToken,
      config.rewardsPerPeriod,
      config.periodLength,
      config.timeLockPeriod,
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

    await stakeToken.connect(owner).transfer(
      edgeStaker.address,
      INIT_BALANCE
    );

    // Approve staking contract to spend staker funds
    await stakeToken.connect(stakerA).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    await stakeToken.connect(stakerB).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    await stakeToken.connect(stakerC).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    await stakeToken.connect(stakerD).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    await stakeToken.connect(stakerF).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    await stakeToken.connect(edgeStaker).approve(await contract.getAddress(), hre.ethers.MaxUint256);
  });

  describe("#getContractRewardsBalance", () => {
    it("Allows a user to see the total rewards remaining in a pool", async () => {
      const rewardsInPool = await contract.getContractRewardsBalance();
      const poolBalance = await rewardsToken.balanceOf(await contract.getAddress());
      expect(rewardsInPool).to.eq(poolBalance);
    });
  });

  describe("#stake", () => {
    it("Can stake an amount successfully and update `totalStaked`", async () => {
      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);

      const totalStakedBefore = await contract.totalStaked();

      await contract.connect(stakerA).stake(DEFAULT_STAKED_AMOUNT);
      stakedAtA = BigInt(await time.latest());
      origStakedAtA = stakedAtA;

      const totalStakedAfter = await contract.totalStaked();

      amountStakedA = DEFAULT_STAKED_AMOUNT;

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtA + config.timeLockPeriod);
      expect(stakerData.owedRewards).to.eq(0n);

      expect(totalStakedAfter - totalStakedBefore).to.eq(DEFAULT_STAKED_AMOUNT);
    });

    it("Can stake a second time as the same user successfully", async () => {
      await time.increase(config.periodLength * 6n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBeforeA = await rewardsToken.balanceOf(stakerA.address);

      const totalStakedBefore = await contract.totalStaked();

      await contract.connect(stakerA).stake(DEFAULT_STAKED_AMOUNT);
      stakedAtA = BigInt(await time.latest());
      amountStakedA += DEFAULT_STAKED_AMOUNT;

      const totalStakedAfter = await contract.totalStaked();

      const expectedRewards = calcTotalRewards(
        [stakedAtA - origStakedAtA],
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfterA = await rewardsToken.balanceOf(stakerA.address);


      const stakerData = await contract.stakers(stakerA.address);

      // They have gained pending rewards but are not yet given them
      expect(pendingRewards).to.eq(expectedRewards);
      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT * 2n);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtA + config.timeLockPeriod);

      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.owedRewards).to.eq(expectedRewards);

      expect(totalStakedAfter - totalStakedBefore).to.eq(DEFAULT_STAKED_AMOUNT);
    });

    it("Can stake as a new user when others are already staked", async () => {
      const pendingRewards = await contract.connect(stakerB).getPendingRewards();

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerB.address);

      await contract.connect(stakerB).stake(DEFAULT_STAKED_AMOUNT);
      stakedAtB = BigInt(await time.latest());
      origStakedAtB = stakedAtB;

      const expectedRewards = calcTotalRewards(
        [stakedAtB - origStakedAtB], // Will be 0
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerB.address);

      const stakerData = await contract.stakers(stakerB.address);

      expect(pendingRewards).to.eq(expectedRewards);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtB + config.timeLockPeriod);

      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtB);
      expect(stakerData.owedRewards).to.eq(expectedRewards);
    });

    it("Fails when the staker doesn't have the funds to stake", async () => {
      const amount = hre.ethers.MaxUint256;

      // First, it will fail on allowance
      await expect(
        contract.connect(notStaker).stake(amount)
      ).to.be.revertedWithCustomError(rewardsToken, INSUFFICIENT_ALLOWANCE_ERR)
        .withArgs(contract.target, 0n, amount);

      // Then after we allow funds, it will fail on balance
      await stakeToken.connect(notStaker).approve(await contract.getAddress(), amount);

      const balance = await stakeToken.balanceOf(notStaker.address);
      await expect(
        contract.connect(notStaker).stake(amount)
      ).to.be.revertedWithCustomError(stakeToken, INSUFFICIENT_BALANCE_ERR)
        .withArgs(notStaker.address, balance, amount);
    });

    it("Fails when the staker tries to stake 0", async () => {
      await expect(
        contract.connect(stakerA).stake(0n)
      ).to.be.revertedWithCustomError(contract, ZERO_STAKE_ERR);
    });
  });

  describe("#getRemainingLockTime", () => {
    it("Allows the user to view the remaining time lock period for a stake", async () => {
      const remainingLockTime = await contract.connect(stakerA).getRemainingLockTime();
      const latest = await time.latest();

      const stakeData = await contract.stakers(stakerA.address);

      // Original lock period and remaining lock period time difference should be the same as
      // the difference between the latest timestamp and that token's stake timestamp
      expect(remainingLockTime).to.eq((stakeData.unlockTimestamp - BigInt(latest)));
    });

    it("Returns 0 for a user that's passed their lock time", async () => {
      await time.increase(config.timeLockPeriod);

      const remainingLockTime = await contract.connect(stakerA).getRemainingLockTime();
      expect(remainingLockTime).to.eq(0n);
    });

    it("Returns 0 for a user that has not staked", async () => {
      const remainingLockTime = await contract.connect(notStaker).getRemainingLockTime();
      expect(remainingLockTime).to.eq(0n);
    });
  });

  describe("#getPendingRewards", () => {
    it("Allows the user to view the pending rewards for a stake", async () => {
      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const expectedRewards = calcTotalRewards(
        [BigInt(await time.latest()) - stakedAtA, stakedAtA - origStakedAtA],
        [amountStakedA, DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      // It will always provide the correct value for the rewards owed to
      // the user, even when the contract does not have the balance for it
      const contractBalance = await rewardsToken.balanceOf(await contract.getAddress());

      expect(contractBalance).to.eq(0n);
      expect(pendingRewards).to.eq(expectedRewards);
    });

    it("Returns 0 for a user that has not staked", async () => {
      const pendingRewards = await contract.connect(notStaker).getPendingRewards();
      expect(pendingRewards).to.eq(0n);
    });

    it("Returns 0 for a user that has staked but not passed a time period", async () => {
      await contract.connect(stakerD).stake(DEFAULT_STAKED_AMOUNT);

      stakedAtD = BigInt(await time.latest());
      origStakedAtD = stakedAtD;

      const stakerData = await contract.stakers(stakerD.address);

      const pendingRewards = await contract.connect(stakerD).getPendingRewards();

      expect(pendingRewards).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtD);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtD + config.timeLockPeriod);
      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
    });
  });

  describe("#claim", () => {
    it("Allows the user to claim their rewards", async () => {
      const pendingRewards = await contract.connect(stakerA).getPendingRewards();
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards
      );

      const totalStakedBefore = await contract.totalStaked();

      await contract.connect(stakerA).claim();
      claimedAtA = BigInt(await time.latest());

      const totalStakedAfter = await contract.totalStaked();

      const expectedRewards = calcTotalRewards(
        [claimedAtA - stakedAtA, stakedAtA - origStakedAtA],
        [amountStakedA, DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(pendingRewards).to.eq(expectedRewards);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + pendingRewards);

      const stakerData = await contract.stakers(stakerA.address);
      expect(stakerData.owedRewards).to.eq(0n);

      expect(totalStakedAfter).to.eq(totalStakedBefore);
    });

    it("Fails when the user has never staked", async () => {
      // `onlyUnlocked` is the first thing checked in this flow
      // and fails when the user has no set unlock timestamp
      await expect(
        contract.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails when the contract has no rewards", async () => {
      // call to claim without first transferring rewards to the contract
      await expect(
        // we are using `stakerB` here, because the check would only hit if the
        // user who calls actually has rewards to claim
        // otherwise, if user has 0 rewards, the check for rewards availability will not hit
        contract.connect(stakerB).claim()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_ERR);
    });

    it("Fails when the user has not passed their lock time", async () => {
      await contract.connect(stakerC).stake(DEFAULT_STAKED_AMOUNT);

      await expect(
        contract.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);

      // Reset
      await contract.connect(stakerC).unstake(DEFAULT_STAKED_AMOUNT, true);
    });
  });

  describe("#unstake", () => {
    it("Allows a user to unstake partially and updates `totalStaked`", async () => {
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

      const totalStakedBefore = await contract.totalStaked();

      await contract.connect(stakerA).unstake(amount, false);

      unstakedAtA = BigInt(await time.latest());
      const totalStakedAfter = await contract.totalStaked();

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

      expect(totalStakedBefore - totalStakedAfter).to.eq(amount);

      // Update the amount the user has left staked in the contract
      amountStakedA -= amount;
    });

    it("Allows a user to fully withdraw their entire staked amount and delete the Staker struct", async () => {
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

    it("Fails when unstaking 0 amount", async () => {
      await expect(
        contract.connect(stakerA).unstake(0, false)
      ).to.be.revertedWithCustomError(contract, ZERO_UNSTAKE_ERR);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstake(DEFAULT_STAKED_AMOUNT, false)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
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
    it("Allows a user to partially unstake without rewards using 'exit' and updates `totalStaked`", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      await time.increase(config.periodLength * 2n);

      const pendingRewards = await contract.connect(stakerC).getPendingRewards();

      const totalStakedBefore = await contract.totalStaked();

      // Allows unstaking with 'exit' before the time lock is over
      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerC).unstake(amount, true);
      unstakedAtC = BigInt(await time.latest());
      amountStakedC -= amount;

      const totalStakedAfter = await contract.totalStaked();

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

      expect(totalStakedBefore - totalStakedAfter).to.eq(amount);
    });

    it("Allows a user to fully unstake without rewards using 'exit' and claim later", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      const pendingRewards = await contract.connect(stakerC).getPendingRewards();

      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerC).unstake(amount, true);

      const exitTime = BigInt(await time.latest());

      const expectedRewards = calcTotalRewards(
        [exitTime - unstakedAtC, unstakedAtC - stakedAtC],
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
      expect(stakerData.lastUpdatedTimestamp).to.eq(exitTime);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtC + config.timeLockPeriod);
      expect(stakerData.owedRewards).to.eq(expectedRewards);

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards
      );

      // claim all rewards to delete struct
      await contract.connect(stakerC).claim();

      // validate struct has been deleted
      const stakerDataAfterClaim = await contract.stakers(stakerC.address);
      expect(stakerDataAfterClaim.amountStaked).to.eq(0n);
      expect(stakerDataAfterClaim.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerDataAfterClaim.unlockTimestamp).to.eq(0n);
      expect(stakerDataAfterClaim.owedRewards).to.eq(0n);
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
      const exitTime = BigInt(await time.latest());

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.unlockTimestamp).to.eq(stakedAtC + config.timeLockPeriod);
      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
      expect(stakerData.lastUpdatedTimestamp).to.eq(exitTime);
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
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_ERR);
    });
  });

  describe("Events", () => {
    it("Emits a Staked event when a user stakes", async () => {
      await expect(
        contract.connect(stakerF).stake(DEFAULT_STAKED_AMOUNT)
      ).to.emit(contract, STAKED_EVENT)
        .withArgs(stakerF.address, DEFAULT_STAKED_AMOUNT, DEFAULT_STAKED_AMOUNT, config.stakingToken);
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

      const pendingRewards = await contract.connect(stakerF).getPendingRewards();
      // fund the contract
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards
      );

      // claim to clear the struct
      await contract.connect(stakerF).claim();

      const stakerDataAfter = await contract.stakers(stakerF.address);

      // make sure the struct is cleared
      expect(stakerDataAfter.amountStaked).to.eq(0n);
      expect(stakerDataAfter.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerDataAfter.unlockTimestamp).to.eq(0n);
      expect(stakerDataAfter.owedRewards).to.eq(0n);
    });

    it("Emits 'LeftoverRewardsWithdrawn' event when the admin withdraws", async () => {
      const balance = await rewardsToken.balanceOf(await contract.getAddress());

      let amount = balance;
      if (balance === 0n) {
        amount = 1231231n;
        await rewardsToken.connect(owner).transfer(
          await contract.getAddress(),
          amount
        );
      }

      await expect(
        contract.connect(owner).withdrawLeftoverRewards()
      ).to.emit(contract, WITHDRAW_EVENT)
        .withArgs(owner.address, amount);
    });
  });

  describe("Special Cases", async () => {
    describe("Exiting", () => {
      // eslint-disable-next-line max-len
      it("#exit from staking should yield the same rewards for partial and full exit within `unlockTimestamp` rules", async () => {
        await rewardsToken.connect(owner).transfer(
          contract.target,
          1000000n
        );

        const stakeAmt = 100n;

        await contract.connect(edgeStaker).stake(stakeAmt);
        const stakeTime = BigInt(await time.latest());

        // partially exit before timelock passed
        const halfStakeAmt = stakeAmt / 2n;
        await contract.connect(edgeStaker).unstake(halfStakeAmt, true);

        const balAfterExit = await rewardsToken.balanceOf(edgeStaker.address);

        const timeToRewards = config.timeLockPeriod + config.periodLength * 2n;
        // increase time to generate rewards
        await time.increase(timeToRewards);

        await contract.connect(edgeStaker).claim();
        const firstClaimTime = BigInt(await time.latest());
        const balAfterFirstClaim = await rewardsToken.balanceOf(edgeStaker.address);

        const rewardsForHalfStake = calcTotalRewards(
          [firstClaimTime - stakeTime],
          [halfStakeAmt],
          config.rewardsPerPeriod,
          config.periodLength
        );

        // should get rewards for the half-stake since he exited before rewards started generating
        expect(balAfterFirstClaim - balAfterExit).to.eq(rewardsForHalfStake);

        const {
          owedRewards: owedRewardsAfterTimelock,
          amountStaked,
        } = await contract.stakers(edgeStaker.address);
        // zero rewards cause he just got them all
        expect(owedRewardsAfterTimelock).to.eq(0n);
        expect(amountStaked).to.eq(halfStakeAmt);

        // increase time to generate rewards for the new period
        await time.increase(timeToRewards);

        // fully exit
        await contract.connect(edgeStaker).unstake(halfStakeAmt, true);

        const {
          owedRewards: owedRewardsAfterExit,
          amountStaked: stakedAfterExit,
        } = await contract.stakers(edgeStaker.address);
        expect(owedRewardsAfterExit).to.eq(rewardsForHalfStake);
        expect(stakedAfterExit).to.eq(0n);

        // even though he exited, rewards have been generated, so he should be able to claim them
        // even though he doesn't have stake in anymore
        await contract.connect(edgeStaker).claim();

        // now make sure staker struct got deleted
        const stakerDataFinal = await contract.stakers(edgeStaker.address);
        expect(stakerDataFinal.amountStaked).to.eq(0n);
        expect(stakerDataFinal.lastUpdatedTimestamp).to.eq(0n);
        expect(stakerDataFinal.unlockTimestamp).to.eq(0n);
        expect(stakerDataFinal.owedRewards).to.eq(0n);

        const balAfterClaim = await rewardsToken.balanceOf(edgeStaker.address);
        expect(balAfterClaim - balAfterFirstClaim).to.eq(rewardsForHalfStake);
      });

      it("should let the user who exits fully after timelock to claim all his available rewards", async () => {
        await rewardsToken.connect(owner).transfer(
          contract.target,
          1000000n
        );

        const stakeAmt = 100n;

        await contract.connect(edgeStaker).stake(stakeAmt);
        const stakeTime = BigInt(await time.latest());

        await time.increase(config.timeLockPeriod + config.periodLength * 2n);

        // fully unstake
        await contract.connect(edgeStaker).unstake(stakeAmt, true);
        const unstakeTime = BigInt(await time.latest());

        const rewardsForFullStake = calcTotalRewards(
          [unstakeTime - stakeTime],
          [stakeAmt],
          config.rewardsPerPeriod,
          config.periodLength
        );

        const {
          owedRewards: owedRewardsInitial,
        } = await contract.stakers(edgeStaker.address);

        expect(owedRewardsInitial).to.eq(rewardsForFullStake);

        const balAfterExit = await rewardsToken.balanceOf(edgeStaker.address);

        await contract.connect(edgeStaker).claim();

        const {
          owedRewards: owedRewardsAfterClaim,
          amountStaked: amountStakedAfterClaim,
          unlockTimestamp,
          lastUpdatedTimestamp,
        } = await contract.stakers(edgeStaker.address);

        expect(owedRewardsAfterClaim).to.eq(0n);
        expect(amountStakedAfterClaim).to.eq(0n);
        expect(unlockTimestamp).to.eq(0n);
        expect(lastUpdatedTimestamp).to.eq(0n);

        const balAfterClaim = await rewardsToken.balanceOf(edgeStaker.address);

        expect(balAfterClaim - balAfterExit).to.eq(rewardsForFullStake);
      });
    });

    describe("Staking Token === Reward Token", () => {
      const stakeAmt = ethers.parseEther("133");
      let stakingContract : StakingERC20;

      it("should NOT give rewards from staked tokens when staking and reward tokens are the same", async () => {
        stakingContract = await stakingFactory.deploy(
          config.rewardsToken, // same token
          config.rewardsToken, // same token
          config.rewardsPerPeriod,
          config.periodLength,
          config.timeLockPeriod,
          owner.address
        ) as StakingERC20;

        await rewardsToken.connect(owner).transfer(
          edgeStaker.address,
          stakeAmt
        );

        await rewardsToken.connect(edgeStaker).approve(
          stakingContract.target,
          stakeAmt
        );

        // stake
        await stakingContract.connect(edgeStaker).stake(stakeAmt);

        const timeToRewards = config.timeLockPeriod + config.periodLength * 2n;

        const pendingRewardsRef = calcTotalRewards(
          [timeToRewards],
          [stakeAmt],
          config.rewardsPerPeriod,
          config.periodLength
        );

        const lessRewards = pendingRewardsRef - 1n;

        // fund contract with a little less rewards
        await rewardsToken.connect(owner).transfer(
          stakingContract.target,
          lessRewards
        );

        // progress time to ref
        await time.increase(timeToRewards);

        const pendingRewardsContract = await stakingContract.connect(edgeStaker).getPendingRewards();
        const rewardsAvailable = await stakingContract.getContractRewardsBalance();
        const totalContractBalance = await rewardsToken.balanceOf(stakingContract.target);

        expect(pendingRewardsContract).to.eq(pendingRewardsRef);
        expect(rewardsAvailable).to.eq(lessRewards);
        expect(totalContractBalance).to.eq(lessRewards + stakeAmt);

        // try to claim
        await expect(
          stakingContract.connect(edgeStaker).claim()
        ).to.be.revertedWithCustomError(stakingContract, NO_REWARDS_ERR);
      });

      it("#withdrawLeftoverRewards() should NOT withdraw staked tokens", async () => {
        // stake more
        await rewardsToken.connect(owner).transfer(
          edgeStaker.address,
          stakeAmt
        );
        await rewardsToken.connect(edgeStaker).approve(
          stakingContract.target,
          stakeAmt
        );
        await stakingContract.connect(edgeStaker).stake(stakeAmt);

        const totalBalBefore = await rewardsToken.balanceOf(stakingContract.target);
        const rewardBalBefore = await stakingContract.getContractRewardsBalance();
        const totalStakedBefore = await stakingContract.totalStaked();
        expect(totalBalBefore).to.eq(rewardBalBefore + totalStakedBefore);
        expect(rewardBalBefore).to.be.lt(totalBalBefore);

        const ownerBalBefore = await rewardsToken.balanceOf(owner.address);
        // withdraw rewards only
        await stakingContract.connect(owner).withdrawLeftoverRewards();

        const ownerBalAfter = await rewardsToken.balanceOf(owner.address);

        expect(ownerBalAfter - ownerBalBefore).to.eq(rewardBalBefore);

        const rewardBalAfter = await stakingContract.getContractRewardsBalance();
        const totalBalAfter = await rewardsToken.balanceOf(stakingContract.target);
        const totalStakedAfter = await stakingContract.totalStaked();

        expect(rewardBalAfter).to.eq(0n);
        expect(totalBalBefore - totalBalAfter).to.eq(rewardBalBefore);
        expect(totalStakedAfter).to.eq(totalStakedBefore);
      });
    });

    describe("Staking with Deflationary Token", () => {
      let stakingToken : DeflERC20Mock;
      let staking : StakingERC20;
      let transferAmtStk : bigint;
      let tokenBalAfterStk : bigint;
      let totalStakedAfterStk : bigint;
      let contractBalAfterStk : bigint;

      const stakeAmt = ethers.parseEther("291");

      it("Should correctly account staked amount on #stake()", async () => {
        const stakingTokenFactory = await hre.ethers.getContractFactory("DeflERC20Mock");
        stakingToken = await stakingTokenFactory.deploy("Deflationary Token", "DTK");

        staking = await stakingFactory.deploy(
          stakingToken.target,
          config.rewardsToken,
          config.rewardsPerPeriod,
          config.periodLength,
          config.timeLockPeriod,
          owner.address
        ) as StakingERC20;

        const transferFeeStk = await stakingToken.getFee(stakeAmt);

        await stakingToken.connect(owner).transfer(
          edgeStaker.address,
          hre.ethers.parseEther("1000")
        );

        await stakingToken.connect(edgeStaker).approve(
          staking.target,
          stakeAmt
        );

        const tokenBalBefore = await stakingToken.balanceOf(edgeStaker.address);
        const totalStakedBefore = await staking.totalStaked();
        const contractBalBefore = await stakingToken.balanceOf(staking.target);

        transferAmtStk = stakeAmt - transferFeeStk;

        // stake and check event in one go
        await expect(
          staking.connect(edgeStaker).stake(stakeAmt)
        ).to.emit(staking, STAKED_EVENT)
          .withArgs(edgeStaker.address, stakeAmt, transferAmtStk, stakingToken.target);

        tokenBalAfterStk = await stakingToken.balanceOf(edgeStaker.address);
        totalStakedAfterStk = await staking.totalStaked();
        contractBalAfterStk = await stakingToken.balanceOf(staking.target);

        const stakerData = await staking.stakers(edgeStaker.address);

        expect(stakerData.amountStaked).to.eq(transferAmtStk);
        expect(totalStakedAfterStk).to.eq(transferAmtStk);
        expect(tokenBalBefore - tokenBalAfterStk).to.eq(stakeAmt);
        expect(totalStakedAfterStk - totalStakedBefore).to.eq(transferAmtStk);
        expect(contractBalAfterStk - contractBalBefore).to.eq(transferAmtStk);
      });

      it("Should correctly account exit amount with #unstake()", async () => {
        // withdraw with `exit`

        // this amount should fail, since the actual staked amount is lower
        await expect(
          staking.connect(edgeStaker).unstake(stakeAmt, true)
        ).to.be.revertedWithCustomError(staking, UNEQUAL_UNSTAKE_ERR);

        // exit with correct amount
        await staking.connect(edgeStaker).unstake(transferAmtStk, true);

        const transferFeeExit = await stakingToken.getFee(transferAmtStk);
        const transferAmtExit = transferAmtStk - transferFeeExit;

        const tokenBalAfterExit = await stakingToken.balanceOf(edgeStaker.address);
        const totalStakedAfterExit = await staking.totalStaked();
        const contractBalAfterExit = await stakingToken.balanceOf(staking.target);

        expect(tokenBalAfterExit - tokenBalAfterStk).to.eq(transferAmtExit);
        expect(totalStakedAfterStk - totalStakedAfterExit).to.eq(transferAmtStk);
        expect(totalStakedAfterExit).to.eq(0n);
        expect(contractBalAfterStk - contractBalAfterExit).to.eq(transferAmtStk);
      });
    });
  });
});
