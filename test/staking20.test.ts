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
  FUNCTION_SELECTOR_ERR,
  INSUFFICIENT_ALLOWANCE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  ZERO_STAKE_ERR,
} from "./helpers/staking";

describe("StakingERC20", () => {

  let deployer : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
  let stakerD : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let contract : StakingERC20;

  let stakeToken : MockERC20;
  let rewardsToken : MockERC20;
  
  // We don't use `PoolConfig` anymore on the contracts but for convenience in testing
  // we can leave this type where it is
  let config : BaseConfig;
  
  // Track first stake and most recent stake times
  let origStakedAtA: bigint;
  let stakedAtA: bigint;

  let origStakedAtB: bigint;
  let stakedAtB: bigint;

  let origStakedAtC: bigint;
  let stakedAtC: bigint;

  let origStakedAtD: bigint;
  let stakedAtD: bigint;

  // Set initial values for stakers
  let amountStakedA: bigint = 0n;
  let amountStakedB: bigint = 0n;
  let amountStakedC: bigint = 0n;
  let amountStakedD: bigint = 0n;

  let balanceAtStakeOneC: bigint;

  let balanceAtUnstakeA: bigint;

  let claimedAtA: bigint;

  let unstakedAtA: bigint;
  let unstakedAtB: bigint;
  let unstakedAtC: bigint;

  let balanceAtStakeOneB: bigint;

  let durationOne: bigint;
  let durationTwo: bigint;

  // Defaults (TODO move to defaults folder)
  const initBalance: bigint = hre.ethers.parseEther("1000000000000");
  const defaultStakedAmount = initBalance / 10000n;

  before(async () => {
    [
      deployer,
      stakerA,
      stakerB,
      stakerC,
      stakerD,
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

    await stakeToken.connect(deployer).transfer(
      stakerD.address,
      initBalance
    );

    // Approve staking contract to spend staker funds
    await stakeToken.connect(stakerA).approve(await contract.getAddress(), initBalance);
    await stakeToken.connect(stakerB).approve(await contract.getAddress(), initBalance);
    await stakeToken.connect(stakerC).approve(await contract.getAddress(), initBalance);
    await stakeToken.connect(stakerD).approve(await contract.getAddress(), initBalance);
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

      await contract.connect(stakerA).stake(defaultStakedAmount);
      stakedAtA = BigInt(await time.latest());
      origStakedAtA = stakedAtA;

      amountStakedA = defaultStakedAmount;

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      // const staked = await contract.getStakedBalance(stakerA.address);
      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - defaultStakedAmount);

      expect(stakerData.amountStaked).to.eq(defaultStakedAmount);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtA + config.timeLockPeriod);
      expect(stakerData.pendingRewards).to.eq(0n);
    });

    it("Can stake a second time as the same user successfully", async () => {
      await time.increase(config.periodLength * 6n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBeforeA = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stake(defaultStakedAmount);
      stakedAtA = BigInt(await time.latest());
      amountStakedA += defaultStakedAmount;

      const expectedRewards = calcTotalRewards(
        [stakedAtA - origStakedAtA],
        [defaultStakedAmount],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfterA = await rewardsToken.balanceOf(stakerA.address);


      const stakerData = await contract.stakers(stakerA.address);

      // They have gained pending rewards but are not yet given them
      expect(pendingRewards).to.eq(expectedRewards);
      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - defaultStakedAmount);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);

      expect(stakerData.amountStaked).to.eq(defaultStakedAmount * 2n);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtA + config.timeLockPeriod);

      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.pendingRewards).to.eq(expectedRewards);
    });

    it("Can stake as a new user when others are already staked", async () => {
      const pendingRewards = await contract.connect(stakerB).getPendingRewards();

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerB.address);

      await contract.connect(stakerB).stake(defaultStakedAmount);
      stakedAtB = BigInt(await time.latest());
      origStakedAtB = stakedAtB;
      amountStakedB += defaultStakedAmount;

      const expectedRewards = calcTotalRewards(
        [stakedAtB - origStakedAtB], // Will be 0
        [defaultStakedAmount],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerB.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerB.address);

      const stakerData = await contract.stakers(stakerB.address);

      expect(pendingRewards).to.eq(expectedRewards);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - defaultStakedAmount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      expect(stakerData.amountStaked).to.eq(defaultStakedAmount);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtB + config.timeLockPeriod);

      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtB);
      expect(stakerData.pendingRewards).to.eq(expectedRewards);
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
        [BigInt(await time.latest()) - stakedAtA, stakedAtA - origStakedAtA],
        [amountStakedA, defaultStakedAmount],
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
      await contract.connect(stakerD).stake(amount);

      stakedAtD = BigInt(await time.latest());
      origStakedAtD = stakedAtD;
      amountStakedD += amount; // TODO need both here?

      const stakerData = await contract.stakers(stakerD.address);

      const pendingRewards = await contract.connect(stakerD).getPendingRewards();

      expect(pendingRewards).to.eq(0n);
      expect(stakerData.pendingRewards).to.eq(0n);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtD);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtD + config.timeLockPeriod);
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
        [claimedAtA - stakedAtA, stakedAtA - origStakedAtA],
        [amountStakedA, defaultStakedAmount],
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

      // Unstake half of the original stake
      const amount = amountStakedA / 2n;
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

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
      expect(stakerData.pendingRewards).to.eq(0n);

      // Update the amount the user has left staked in the contract
      amountStakedA -= amount;
    });

    it("Allows a user to fully withdraw their entire staked amount", async () => {
      await time.increase(config.periodLength * 11n);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

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
      expect(stakerData.pendingRewards).to.eq(0n);
    })

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstake(defaultStakedAmount, false)
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails when the user has not passed their lock time", async () => {
      await contract.connect(stakerC).stake(defaultStakedAmount);
      stakedAtC = BigInt(await time.latest());
      origStakedAtC = stakedAtC;

      const pendingRewards = await contract.connect(stakerC).getPendingRewards();

      const balanceAtStakeOne = defaultStakedAmount;

      amountStakedC += defaultStakedAmount;

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.unlockTimestamp).to.eq(origStakedAtC + config.timeLockPeriod);
      expect(stakerData.amountStaked).to.eq(amountStakedC);
      expect(stakerData.pendingRewards).to.eq(pendingRewards);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtC);

      // Fail to unstake with rewards when not passed time lock period
      await expect(
        contract.connect(stakerC).unstake(defaultStakedAmount, false)
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    })
  });

  describe("#unstake with 'exit'", () => {
    it("Allows a user to partially unstake without rewards using 'exit'", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      await time.increase(config.periodLength * 2n);
      
      const pendingRewards = await contract.connect(stakerC).getPendingRewards();

      // Allows unstaking with 'exit' before the time lock is over
      const amount = defaultStakedAmount / 2n;
      await contract.connect(stakerC).unstake(amount, true);
      unstakedAtC = BigInt(await time.latest());
      amountStakedC -= amount;

      const expectedRewards = calcTotalRewards(
        [unstakedAtC - origStakedAtC],
        [defaultStakedAmount],
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
      expect(stakerData.unlockTimestamp).to.eq(stakedAtC + config.timeLockPeriod);
      expect(stakerData.pendingRewards).to.eq(pendingRewards);
    });

    it("Allows a user to fully unstake without rewards using 'exit'", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      const pendingRewards = await contract.connect(stakerC).getPendingRewards();

      const amount = defaultStakedAmount / 2n;
      await contract.connect(stakerC).unstake(amount, true);

      const timestamp = BigInt(await time.latest());

      const expectedRewards = calcTotalRewards(
        [timestamp - unstakedAtC, unstakedAtC - stakedAtC],
        [defaultStakedAmount / 2n, defaultStakedAmount],
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
      expect(stakerData.pendingRewards).to.eq(0n);
    });
  })



  /**
   * TODO cases
   * stake first time when other user already staked
   * 
   * claim fails when the pool has no rewards
   * 
   * unstake with 'exit'
   * fails exit when more than initial stake
   * fails unstake when ore than intial stake
   * 
   * unstaking right after staking rewards nothing if the period is not met
   * 
   * events
   * 
   * other configs
   * 
   * long more advanced test similar to erc721
   */
});
