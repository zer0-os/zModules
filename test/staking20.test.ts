import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20,
  StakingERC20,
} from "../typechain";
import {
  NO_REWARDS_ERR,
  TIME_LOCK_NOT_PASSED_ERR,
  INSUFFICIENT_ALLOWANCE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  UNEQUAL_UNSTAKE_ERR,
  OWNABLE_UNAUTHORIZED_ERR,
  INVALID_STAKE_ERR,
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

describe.only("StakingERC20", () => {
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

  // The amount we increase the `block.timestamp` by whenever we mine manually
  const timeIncreaseAmount = 5n;

  // Track first stake and most recent stake times
  let origStakedAtA : bigint;
  let stakedAtA :  bigint;
  let claimedAtA : bigint;
  let unstakedAtA : bigint;
  let amountStakedA = 0n;

  let origStakedAtB : bigint;
  let stakedAtB : bigint;

  let origStakedAtC : bigint;
  let stakedAtC : bigint;
  let unstakedAtC : bigint;
  let amountStakedC = 0n;

  let origStakedAtD : bigint;
  let stakedAtD : bigint;

  let stakedAtF : bigint;
  let claimedAtF : bigint;
  let unstakedAtF : bigint;


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
    stakeToken = await mockERC20Factory.deploy("MEOW", "MEOW");

    rewardsToken = await mockERC20Factory.deploy("WilderWorld", "WW");

    config = await createDefaultConfigs(rewardsToken, undefined, stakeToken);

    const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");

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

    // Approve staking contract to spend staker funds
    await stakeToken.connect(stakerA).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    await stakeToken.connect(stakerB).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    await stakeToken.connect(stakerC).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    await stakeToken.connect(stakerD).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    await stakeToken.connect(stakerF).approve(await contract.getAddress(), hre.ethers.MaxUint256);

    // Always start at the same block going forward, disable auto mining for each tx
    await hre.network.provider.send("evm_setAutomine", [false]);
    await time.increaseTo(1720000000)
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
      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stake(DEFAULT_STAKED_AMOUNT);

      // Always mine block before expects
      // Always update timestamps after mining a block
      // TODO move timestamp by more than one, change after debugging
      // TODO issues when using `time. increase(1)`?

      await time.increase(timeIncreaseAmount);
      stakedAtA = BigInt(await time.latest());
      origStakedAtA = stakedAtA;

      amountStakedA = DEFAULT_STAKED_AMOUNT;

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);
      
      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);
      
      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtA + config.timeLockPeriod);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Can stake a second time as the same user successfully", async () => {
      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBeforeA = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stake(DEFAULT_STAKED_AMOUNT);

      // Mine block for tx
      await time.increase(timeIncreaseAmount);
      stakedAtA = BigInt(await time.latest());
      amountStakedA += DEFAULT_STAKED_AMOUNT;

      const stakerData = await contract.stakers(stakerA.address);

      // Includes the `staker.owedRewards` calculated from second stake addition
      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const expectedRewards = calcTotalRewards(
        [stakedAtA - origStakedAtA],
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      expect(pendingRewards).to.eq(expectedRewards);

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfterA = await rewardsToken.balanceOf(stakerA.address);

      // They have gained pending rewards but are not yet given them
      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT * 2n);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtA + config.timeLockPeriod);

      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.owedRewards).to.eq(expectedRewards);
    });

    it("Can stake as a new user when others are already staked", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerB.address);

      await contract.connect(stakerB).stake(DEFAULT_STAKED_AMOUNT);

      // Mine block for tx
      await time.increase(timeIncreaseAmount);
      stakedAtB = BigInt(await time.latest());
      origStakedAtB = stakedAtB;

      const pendingRewards = await contract.connect(stakerB).getPendingRewards();

      const expectedRewards = calcTotalRewards(
        [stakedAtB - origStakedAtB], // will be the same values
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerB.address);

      const stakerData = await contract.stakers(stakerB.address);

      expect(expectedRewards).to.eq(0n);
      expect(pendingRewards).to.eq(expectedRewards);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfter).to.eq(0n);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtB + config.timeLockPeriod);

      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtB);
      expect(stakerData.owedRewards).to.eq(expectedRewards);
    });

    it("Fails when the staker doesn't have the funds to stake", async () => {
      // Using the `await expect(...).to.be.revertedWithCustomError` syntax doesn't work
      // when automining is off and we cant call to mine in the hook, or call the expect on
      // the `time.increase()` call.
      await hre.network.provider.send("evm_setAutomine", [true]);

      await expect(
        contract.connect(notStaker).stake(DEFAULT_STAKED_AMOUNT)
      ).to.be.revertedWithCustomError(stakeToken, INSUFFICIENT_ALLOWANCE_ERR)
      .withArgs(await contract.getAddress(), 0, DEFAULT_STAKED_AMOUNT);


      // Then after we allow funds, it will fail on balance
      await stakeToken.connect(notStaker).approve(await contract.getAddress(), DEFAULT_STAKED_AMOUNT);

      const balance = await stakeToken.balanceOf(notStaker.address);

      await expect(
        contract.connect(notStaker).stake(DEFAULT_STAKED_AMOUNT)
      ).to.be.revertedWithCustomError(stakeToken, INSUFFICIENT_BALANCE_ERR)
        .withArgs(notStaker.address, balance, DEFAULT_STAKED_AMOUNT);

      await hre.network.provider.send("evm_setAutomine", [false]);
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
      const latest = BigInt(await time.latest());
      const before = await contract.connect(stakerA).getPendingRewards();

      const expectedRewards = calcTotalRewards(
        [latest - stakedAtA, stakedAtA - origStakedAtA],
        [amountStakedA, DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      console.log("latest time before big increase", latest);
      await time.increase(config.timeLockPeriod);
      const latestAfter = BigInt(await time.latest());
      console.log("latest time after big increase", latestAfter);

      const expectedRewardsAfter = calcTotalRewards(
        [latestAfter - stakedAtA, stakedAtA - origStakedAtA],
        [amountStakedA, DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const after = await contract.connect(stakerA).getPendingRewards();

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
      await hre.network.provider.send("evm_setAutomine", [false]);
      
      await contract.connect(stakerD).stake(DEFAULT_STAKED_AMOUNT);

      await time.increase(timeIncreaseAmount);
      stakedAtD = BigInt(await time.latest());
      origStakedAtD = stakedAtD;

      console.log("stakedAtD: ", stakedAtD);

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
      await time.increase(config.timeLockPeriod);
      const latest = BigInt(await time.latest());

      // We calculate with two transactions worth of additional time because we know the
      // timestamp is modified from the transfer of funds as well as `claim` execution
      const expectedRewards = calcTotalRewards(
        [latest + (timeIncreaseAmount * 2n) - stakedAtA, stakedAtA - origStakedAtA],
        [amountStakedA, DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      // Give staking contract balance to pay rewards
      // Note: We cant use `pendingRewards` from the contract here because
      // calling them *before* calling `claim` will result in an incorrect value 
      // due to HH incrementing timestamp before execution of the code,
      // and calling *after* will result in 0 as they've been transferred
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        expectedRewards
      );
      await time.increase(timeIncreaseAmount);

      await contract.connect(stakerA).claim();

      // Mine block for tx
      await time.increase(timeIncreaseAmount);
      claimedAtA = BigInt(await time.latest());

      // await time.increase(timeIncreaseAmount);
      claimedAtA = BigInt(await time.latest());

      const stakerData = await contract.stakers(stakerA.address);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + expectedRewards);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Fails when the user has never staked", async () => {
      // `onlyUnlocked` is the first thing checked in this flow
      // and fails when the user has no set unlock timestamp
      await hre.network.provider.send("evm_setAutomine", [true]);

      await expect(
        contract.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails when the contract has no rewards", async () => {
      // call to claim without first transferring rewards to the contract
      await expect(
        contract.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_ERR);
    });

    it("Fails when the user has not passed their lock time", async () => {
      await contract.connect(stakerC).stake(DEFAULT_STAKED_AMOUNT);

      await expect(
        contract.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);

      // Reset
      await contract.connect(stakerC).unstake(DEFAULT_STAKED_AMOUNT, true);

      await hre.network.provider.send("evm_setAutomine", [false]);
    });
  });

  describe("#unstake", () => {
    it("Allows a user to unstake partially", async () => {
      await time.increase(config.periodLength * 7n);

      // Unstake half of the original stake
      const amount = amountStakedA / 2n;
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      // Calculate the rewards we expect after the next 3 transactions have occurred.
      const expectedRewards = calcTotalRewards(
        [BigInt(await time.latest()) + timeIncreaseAmount * 2n - claimedAtA],
        [amountStakedA],
        config.rewardsPerPeriod,
        config.periodLength
      );

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        expectedRewards
      );
      await time.increase(timeIncreaseAmount);

      await contract.connect(stakerA).unstake(amount, false);
      await time.increase(timeIncreaseAmount);

      unstakedAtA = BigInt(await time.latest());

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + amount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + expectedRewards);

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

      const expectedRewards = calcTotalRewards(
        [BigInt(await time.latest()) + timeIncreaseAmount * 2n - unstakedAtA],
        [amountStakedA],
        config.rewardsPerPeriod,
        config.periodLength
      )

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        expectedRewards
      );
      await time.increase(timeIncreaseAmount);

      await contract.connect(stakerA).unstake(amountStakedA, false);
      await time.increase(timeIncreaseAmount);
      unstakedAtA = BigInt(await time.latest());

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + amountStakedA);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + expectedRewards);

      const stakerData = await contract.stakers(stakerA.address);

      // Verify all values are reset to 0 after full withdrawal
      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerData.unlockTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Fails when the user has never staked", async () => {
      await hre.network.provider.send("evm_setAutomine", [true]);

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

      await hre.network.provider.send("evm_setAutomine", [false]);
    });
  });

  describe("#unstake with 'exit'", () => {
    it("Allows a user to partially unstake without rewards using 'exit'", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      await time.increase(config.periodLength * 2n);

      // TODO one change that will affect exit is that we no longer delete the staker struct
      // in the same place, we keep their rewards for them to claim later
      // Change this behaviour here after merging those changes

      const expectedRewards = calcTotalRewards(
        [BigInt(await time.latest()) + timeIncreaseAmount - origStakedAtC],
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      // Allows unstaking with 'exit' before the time lock is over
      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerC).unstake(amount, true);
      await time.increase(timeIncreaseAmount);

      unstakedAtC = BigInt(await time.latest());
      amountStakedC -= amount;

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

      // Confirm they have pending rewards but don't receive them
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.amountStaked).to.eq(amount);
      expect(stakerData.lastUpdatedTimestamp).to.eq(unstakedAtC);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtC + config.timeLockPeriod);
      expect(stakerData.owedRewards).to.eq(expectedRewards);
    });

    it("Allows a user to fully unstake without rewards using 'exit'", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      const amount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerC).unstake(amount, true);
      await time.increase(timeIncreaseAmount);

      unstakedAtC = BigInt(await time.latest());
      const stakeBalanceAfter = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

      // Confirm they have pending rewards but don't receive them
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerData.unlockTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n); // TODO this will change after merging other changes, no longer deleting
    });

    it("Fails when the user has never staked", async () => {
    await hre.network.provider.send("evm_setAutomine", [true]);

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

      await hre.network.provider.send("evm_setAutomine", [false]);
    });
  });

  describe("#withdrawLeftoverRewards", () => {
    it("Allows the admin to withdraw leftover rewards", async () => {
      const amount = 1000n;
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        amount
      );
      await time.increase(timeIncreaseAmount);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(owner.address);
      const contractRewardsBalanceBefore = await contract.getContractRewardsBalance();

      await contract.connect(owner).withdrawLeftoverRewards();
      await time.increase(timeIncreaseAmount);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(owner.address);
      const contractRewardsBalanceAfter = await contract.getContractRewardsBalance();

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + amount);
      expect(contractRewardsBalanceAfter).to.eq(contractRewardsBalanceBefore - amount);
      expect(contractRewardsBalanceAfter).to.eq(0n);
    });

    it("Fails when the caller is not the admin", async () => {
      await hre.network.provider.send("evm_setAutomine", [true]);
      
      await expect(
        contract.connect(notStaker).withdrawLeftoverRewards()
      ).to.be.revertedWithCustomError(contract, OWNABLE_UNAUTHORIZED_ERR)
        .withArgs(notStaker.address);
    });

    it("Fails when the contract has no rewards left to withdraw", async () => {
      await expect(
        contract.connect(owner).withdrawLeftoverRewards()
      ).to.be.revertedWithCustomError(contract, NO_REWARDS_ERR);

      await hre.network.provider.send("evm_setAutomine", [false]);
    });
  });

  describe("Events", () => {
    it("Emits a Staked event when a user stakes", async () => {
      await hre.network.provider.send("evm_setAutomine", [true]);

      await expect(
        contract.connect(stakerF).stake(DEFAULT_STAKED_AMOUNT)
      ).to.emit(contract, STAKED_EVENT)
        .withArgs(stakerF.address, DEFAULT_STAKED_AMOUNT, config.stakingToken);
      
        stakedAtF = BigInt(await time.latest());

      await hre.network.provider.send("evm_setAutomine", [false]);
    });

    it("Emits a Claimed event when a user claims rewards", async () => {
      await time.increase(config.timeLockPeriod);

      const pendingRewards = await contract.connect(stakerF).getPendingRewards();

      // Calculate for future transactions. +5 for manual time increase in transfer,
      // and an extra + 1 for auto time increase when calling `claim`
      const expectedRewards = calcTotalRewards(
        [BigInt(await time.latest()) + timeIncreaseAmount + 1n - stakedAtF],
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      // console.log(expectedRewards)
      // console.log(pendingRewards)

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        expectedRewards
      );
      await time.increase(timeIncreaseAmount);

      await hre.network.provider.send("evm_setAutomine", [true]);

      await expect(
        contract.connect(stakerF).claim()
      ).to.emit(contract, CLAIMED_EVENT)
        .withArgs(stakerF.address, expectedRewards, config.rewardsToken);

      claimedAtF = BigInt(await time.latest());

      await hre.network.provider.send("evm_setAutomine", [false]);
    });

    it("Emits an Unstaked event when a user unstakes", async () => {
      await time.increase(config.periodLength * 3n);

      // Calculate for future transactions. +5 for manual time increase in transfer,
      // and an extra + 1 for auto time increase when calling `claim`
      const expectedRewards = calcTotalRewards(
        [BigInt(await time.latest()) + timeIncreaseAmount + 1n - claimedAtF],
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        expectedRewards
      );
      await time.increase(timeIncreaseAmount);

      const stakerData = await contract.stakers(stakerF.address);

      await hre.network.provider.send("evm_setAutomine", [true]);

      await expect(
        contract.connect(stakerF).unstake(stakerData.amountStaked / 2n, false)
      ).to.emit(contract, UNSTAKED_EVENT)
        .withArgs(stakerF.address, stakerData.amountStaked / 2n, config.stakingToken);
      
      unstakedAtF = BigInt(await time.latest());
      await hre.network.provider.send("evm_setAutomine", [false]);
    });

    it("Emits an Unstaked event when a user exits with unstake", async () => {
      await time.increase(config.periodLength * 7n);

      const stakerData = await contract.stakers(stakerF.address);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerF.address);
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerF.address);

      await hre.network.provider.send("evm_setAutomine", [true]);

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

    // it("Emits 'LeftoverRewardsWithdrawn' event when the admin withdraws", async () => {
    //   const amount = 1000n;
    //   await rewardsToken.connect(owner).transfer(
    //     await contract.getAddress(),
    //     amount
    //   );

    //   await expect(
    //     contract.connect(owner).withdrawLeftoverRewards()
    //   ).to.emit(contract, WITHDRAW_EVENT)
    //     .withArgs(owner.address, amount);
    // });
  });
});
