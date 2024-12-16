import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20,
  StakingERC20, ZeroVotingERC20,
} from "../typechain";
import {
  TIME_LOCK_NOT_PASSED_ERR,
  INSUFFICIENT_BALANCE_ERR,
  ZERO_VALUE_ERR,
  UNEQUAL_UNSTAKE_ERR,
  OWNABLE_UNAUTHORIZED_ERR,
  ZERO_REWARDS_ERR,
  LOCK_TOO_SHORT_ERR,
  INSUFFICIENT_CONTRACT_BALANCE_ERR,
  NOT_FULL_EXIT_ERR,
} from "./helpers/errors";
import {
  WITHDRAW_EVENT,
  INIT_BALANCE,
  DEFAULT_STAKED_AMOUNT,
  createDefaultStakingConfig,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  BaseConfig,
  DEFAULT_LOCK,
  DAY_IN_SECONDS,
  calcLockedRewards,
  calcTotalUnlockedRewards,
  calcTotalLockedRewards,
  calcStakeRewards,
  DEFAULT_MINIMUM_LOCK,
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
  let stakeRepToken : ZeroVotingERC20;

  let config : BaseConfig;

  // Use this to reset the contract state
  let reset : () => Promise<void>;

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
    const stakeRepFactory = await hre.ethers.getContractFactory("ZeroVotingERC20");

    reset = async () => {
      stakeToken = await mockERC20Factory.deploy("MEOW", "MEOW");
      rewardsToken = await mockERC20Factory.deploy("WilderWorld", "WW");
      stakeRepToken = await stakeRepFactory.deploy("VotingToken", "VTKN", owner);

      config = await createDefaultStakingConfig(
        rewardsToken,
        owner,
        undefined,
        stakeToken,
        stakeRepToken,
      );

      contract = await stakingFactory.deploy(config) as StakingERC20;

      await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), await contract.getAddress());
      await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), await contract.getAddress());

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
    };

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
    let stakedAt : bigint;
    it("Can stake without a lock successfully and mint proper amount of `stakeRepToken`", async () => {
      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);

      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);

      stakedAt = BigInt(await time.latest());

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);

      expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore + DEFAULT_STAKED_AMOUNT);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(stakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Can stake a second time without a lock as the same user successfully", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 3n);

      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBeforeA = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const secondStakedAt = BigInt(await time.latest());

      const stakerData = await contract.stakers(stakerA.address);

      const expectedRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        secondStakedAt - stakedAt,
        false,
        config
      );

      expect(stakerData.owedRewards).to.eq(expectedRewards);

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfterA = await rewardsToken.balanceOf(stakerA.address);

      // They have gained pending rewards but are not yet given them
      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);
      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT * 2n);
      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.unlockedTimestamp).to.eq(0n); // No time lock
      expect(stakerData.lastTimestamp).to.eq(secondStakedAt);
    });

    it("Can stake with a lock successfully and mint proper amount of `stakeRepToken`", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.lastTimestampLocked).to.eq(stakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);

      expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore + DEFAULT_STAKED_AMOUNT);
    });

    // eslint-disable-next-line max-len
    it("Can stake a second time with a lock as the same user successfully and get proper amount of `stakeRepToken`", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      // If we don't increase time between two stakes it breaks
      // what is the smallest amount we can increase and it passes?
      // 20n passes, DIS / 20 = 4319 seconds = ~72 minutes
      // Any less and it fails
      // await time.increase(4319);

      const stakerDataBefore = await contract.stakers(stakerA.address);

      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      const stakerDataAfter = await contract.stakers(stakerA.address);

      expect(stakerDataAfter.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT * 2n);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(stakedAt);
      expect(stakerDataAfter.unlockedTimestamp).to.eq(stakerDataBefore.unlockedTimestamp);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - DEFAULT_STAKED_AMOUNT);

      expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore + DEFAULT_STAKED_AMOUNT);
    });

    it("Calculates in between rewards correctly after initial lock duration is complete", async () => {
      await reset();

      const futureRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        DEFAULT_LOCK,
        true,
        config
      );

      const futureRewardsContract = await contract.getStakeRewards(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK, true);

      expect(futureRewards).to.eq(futureRewardsContract);

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const interimTime = DAY_IN_SECONDS * 17n;
      await time.increase(DEFAULT_LOCK + interimTime);

      const addedStake = hre.ethers.parseEther("900");
      const addedStakeLock = DAY_IN_SECONDS * 30n;

      const secondFutureRewards = calcStakeRewards(
        addedStake,
        addedStakeLock,
        true,
        config
      );

      await contract.connect(stakerA).stakeWithLock(addedStake, addedStakeLock);
      const latest = BigInt(await time.latest());
      const stakerDataAfter = await contract.stakers(stakerA.address);

      // The time in between stake A and B should be rewarded at rate 1.0
      const expectedRewards = calcStakeRewards(DEFAULT_STAKED_AMOUNT, interimTime + 1n, false, config);

      expect(stakerDataAfter.owedRewardsLocked).to.eq(futureRewards + secondFutureRewards + expectedRewards);
      expect(stakerDataAfter.owedRewards).to.eq(0n);
    });

    it("Does not update the amount of remaining time on follow up stakes with lock", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      const stakerData = await contract.stakers(stakerA.address);

      const firstStakeValue = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        DEFAULT_LOCK,
        true,
        config
      );

      expect(stakerData.lastTimestampLocked).to.eq(stakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);
      expect(stakerData.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.owedRewardsLocked).to.eq(firstStakeValue);

      await time.increase(DEFAULT_LOCK / 2n);
      const latest = BigInt(await time.latest());

      const addedStake = hre.ethers.parseEther("900");
      const addedStakeLock = DAY_IN_SECONDS * 30n;

      // Even though we do provide lock time for this stake, the user has already locked
      // and so it isn't used. This stake is valued as though it extends to the end of the
      // existing lock

      // multiplier should be based on remaining lock time, not
      const secondStakedValue = calcStakeRewards(
        addedStake,
        stakerData.unlockedTimestamp - latest - 1n, // amount of time remaining in lock
        true,
        config,
        stakerData.rewardsMultiplier,
      );

      // Additional locked stakes disregard the incoming lock duration
      await contract.connect(stakerA).stakeWithLock(addedStake, addedStakeLock);
      const secondStakedAt = BigInt(await time.latest());

      const stakerDataAfter = await contract.stakers(stakerA.address);

      expect(stakerDataAfter.owedRewardsLocked).to.eq(firstStakeValue + secondStakedValue);
      expect(stakerDataAfter.owedRewards).to.eq(0n);

      expect(stakerDataAfter.lastTimestampLocked).to.eq(secondStakedAt);

      // Second stake lock was less duration total, so the unlockedTimestamp wasn't changed
      expect(stakerDataAfter.unlockedTimestamp).to.eq(stakerData.unlockedTimestamp);
      expect(stakerDataAfter.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT + addedStake);
    });

    it("Can stake as a new user without lock when others are already staked", async () => {
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

    it("Fails when the staker locks for less than the minimum lock time", async () => {
      await expect(
        contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_MINIMUM_LOCK - 1n)
      ).to.be.revertedWithCustomError(contract, LOCK_TOO_SHORT_ERR);
    });

    it("Fails when the staker doesn't have the funds to stake", async () => {
      const amount = hre.ethers.parseEther("150");

      await stakeToken.connect(notStaker).approve(await contract.getAddress(), amount);

      try {
        await contract.connect(notStaker).stakeWithLock(amount, DEFAULT_LOCK);
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_BALANCE_ERR);
      }
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

      expect(remainingLockTime).to.eq(((DEFAULT_LOCK / 2n)));
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
    let stakedAt : bigint;
    let checkpoint : bigint;

    it("Allows the user to view the pending rewards for a stake without a lock", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 4n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      checkpoint = BigInt(await time.latest());
      const futureExpectedRewards = calcTotalUnlockedRewards(
        [checkpoint - stakedAt],
        [DEFAULT_STAKED_AMOUNT],
        config
      );

      expect(pendingRewards).to.eq(futureExpectedRewards);
    });

    it("Updates their pending rewards appropriately when staking again without a lock", async () => {
      const stakerData = await contract.stakers(stakerA.address);

      // Because we haven't added any additional stake, `owedRewards` is not updated yet
      expect(stakerData.owedRewards).to.eq(0n);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAtTwo = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 4n);

      const stakerDataTwo = await contract.stakers(stakerA.address);


      // we get all owed rewards between the two stakes in the added rewards
      // but we don't calculate any future rewards until the user calls
      const expectedRewards = calcTotalUnlockedRewards(
        [checkpoint - stakedAt + 1n],
        [DEFAULT_STAKED_AMOUNT],
        config
      );

      expect(stakerDataTwo.amountStaked).to.eq(stakerData.amountStaked + DEFAULT_STAKED_AMOUNT);
      expect(stakerDataTwo.owedRewards).to.eq(expectedRewards);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const expectedRewardsFull = calcTotalUnlockedRewards(
        [checkpoint - stakedAt + 1n, BigInt(await time.latest()) - stakedAtTwo],
        [DEFAULT_STAKED_AMOUNT, DEFAULT_STAKED_AMOUNT * 2n],
        config
      );

      expect(expectedRewardsFull).to.eq(pendingRewards);
    });

    it("Returns 0 for a user that is staked with a lock that they have not passed", async () => {
      // TODO do we want users to be able to see values that are not yet claimable?
      await reset();
      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK / 4n);

      const pendingRewardsLocked = await contract.connect(stakerA).getPendingRewards();
      expect(pendingRewardsLocked).to.eq(0n);
    });

    it("Includes the locked rewards in the sum when a user has passed their lock period", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakerData = await contract.stakers(stakerA.address);

      const stakeValue = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        DEFAULT_LOCK,
        true,
        config,
        stakerData.rewardsMultiplier,
      );

      await time.increase(DEFAULT_LOCK);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      expect(pendingRewards).to.eq(stakeValue);
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
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 4n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        pendingRewards * 2n // account for +1s timestamp execution
      );

      await contract.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      // TODO AMOUNT CHECK NOW THAT UPDATE
      const expectedRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        claimedAt - stakedAt,
        false,
        config
      );

      const stakerData = await contract.stakers(stakerA.address);

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + expectedRewards);
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
      try {
        await contract.connect(stakerA).claim();
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_BALANCE_ERR);
      }

      // Provide rewards to give
      await rewardsToken.connect(owner).transfer(await contract.getAddress(), hre.ethers.parseEther("5000"));

      const balanceBefore = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const balanceAfter = await rewardsToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      const expectedRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        DEFAULT_LOCK,
        true,
        config,
        stakerData.rewardsMultiplier
      );

      const interimRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        claimedAt - stakerData.unlockedTimestamp,
        false,
        config
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards + interimRewards);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(contract, ZERO_REWARDS_ERR);
    });

    it("Fails when the contract has no rewards", async () => {
      const remainingContractRewards = await contract.getContractRewardsBalance();
      const rewardsBalanceFromToken = await rewardsToken.balanceOf(await contract.getAddress());

      expect(remainingContractRewards).to.eq(rewardsBalanceFromToken);

      if (remainingContractRewards > 0n) {
        await contract.connect(owner).withdrawLeftoverRewards();
      }

      try {
        await contract.connect(stakerA).claim();
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_BALANCE_ERR);
      }
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
    it("Allows a user to unstake non-locked amount partially and burns `stakeRepToken`", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 2n);

      // Unstake half of the original stake

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakeToken.balanceOf(stakerA.address);

      const unstakeAmount = DEFAULT_STAKED_AMOUNT / 2n;


      // Give staking contract balance to pay rewards
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        hre.ethers.parseEther("100000")
      );

      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).unstake(unstakeAmount, false);

      const unstakedAt = BigInt(await time.latest());
      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);

      const stakeRewards = calcStakeRewards(
        unstakeAmount,
        unstakedAt - stakedAt,
        false,
        config
      );

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + unstakeAmount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + stakeRewards);
      expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore - unstakeAmount);
      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + unstakeAmount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + stakeRewards);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT / 2n);
      expect(stakerData.lastTimestamp).to.eq(unstakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(0n); // User has no locked stake
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Allows a user to fully withdraw their entire non-locked staked amount and burns `stakeRepToken`", async () => {
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

      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).unstake(stakerDataBefore.amountStaked, false);

      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakeToken.balanceOf(stakerA.address);

      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + stakerDataBefore.amountStaked);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + futureExpectedRewards);
      expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore - stakerDataBefore.amountStaked);

      const stakerDataAfter = await contract.stakers(stakerA.address);

      // Verify all values are reset to 0 after full withdrawal
      expect(stakerDataAfter.amountStaked).to.eq(0n);
      expect(stakerDataAfter.lastTimestamp).to.eq(0n);
      expect(stakerDataAfter.unlockedTimestamp).to.eq(0n);
      expect(stakerDataAfter.owedRewards).to.eq(0n);
    });

    it("Fails to unstake 0 amount", async () => {
      await expect(
        contract.connect(stakerA).unstake(0, false)
      ).to.be.revertedWithCustomError(contract, ZERO_VALUE_ERR);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstake(DEFAULT_STAKED_AMOUNT, false)
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

      try {
        await contract.connect(stakerA).unstake(stakerData.amountStaked, false);
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_BALANCE_ERR);
      }
    });
  });

  describe("#unstakeLocked", () => {
    // eslint-disable-next-line max-len
    it("Allows a user to partially unstake locked funds when passed their lock time and burns `stakeRepToken`", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      const stakerData = await contract.stakers(stakerA.address);
      const stakeRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        DEFAULT_LOCK,
        true,
        config,
        stakerData.rewardsMultiplier,
      );

      await time.increase(DEFAULT_LOCK);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      const stakerDataBefore = await contract.stakers(stakerA.address);

      expect(stakerDataBefore.amountStakedLocked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerDataBefore.owedRewardsLocked).to.eq(stakeRewards);

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        stakeRewards * 2n
      );

      const amount = DEFAULT_STAKED_AMOUNT / 2n;

      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).unstakeLocked(amount, false);
      const unstakedAt = BigInt(await time.latest());

      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);

      // should only be 1s more than stakeValue
      const interimRewards = calcStakeRewards(
        amount,
        unstakedAt - stakerDataBefore.unlockedTimestamp,
        false,
        config
      );

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + stakeRewards + interimRewards);
      expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore - amount);

      const stakerDataAfter = await contract.stakers(stakerA.address);

      expect(stakerDataAfter.amountStakedLocked).to.eq(stakerDataBefore.amountStakedLocked - amount);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(unstakedAt);
      expect(stakerDataAfter.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);
      expect(stakerDataAfter.owedRewardsLocked).to.eq(0n);
    });

    // eslint-disable-next-line max-len
    it("Allows a user to fully unstake locked funds when passed their lock time and burns `stakeRepToken`", async () => {
      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      const stakerDataBefore = await contract.stakers(stakerA.address);

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        hre.ethers.parseEther("5000")
      );

      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).unstakeLocked(DEFAULT_STAKED_AMOUNT / 2n, false);

      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      const interimRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakerDataBefore.lastTimestampLocked],
        [DEFAULT_STAKED_AMOUNT / 2n],
        config
      );

      // Already was given stake value, should only get interim rewards
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + interimRewards);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + DEFAULT_STAKED_AMOUNT / 2n);
      expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore - DEFAULT_STAKED_AMOUNT / 2n);

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

      try {
        await contract.connect(stakerA).unstakeLocked(DEFAULT_STAKED_AMOUNT, false);
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_BALANCE_ERR);
      }
    });
  });

  describe("#unstakeLocked with 'exit'", () => {
    it("Allows a user to fully unstake using 'exit' within lock duration and burns `stakeRepToken`", async () => {
      await reset();

      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);
      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerC.address);

      const stakerDataBefore = await contract.stakers(stakerC.address);

      const unstakeAmount = stakerDataBefore.amountStakedLocked
      await contract.connect(stakerC).unstakeLocked(unstakeAmount, true);

      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerC.address);
      const stakeBalanceAfter = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

      // Confirm they have not received rewards
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + unstakeAmount);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + stakerDataBefore.amountStakedLocked);
      expect(repTokenBalanceAfter).to.eq(repTokenBalanceBefore - unstakeAmount);

      const stakerData = await contract.stakers(stakerC.address);

      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.lastTimestampLocked).to.eq(0n);
      expect(stakerData.unlockedTimestamp).to.eq(0n);
      expect(stakerData.owedRewardsLocked).to.eq(0n);
    });

    it("Doesn't effect non-locked funds when user fully unstakes using 'exit' after lock duration", async () => {
      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      const stakerDataBefore = await contract.stakers(stakerC.address);

      // Some arbitrary amount of extra time
      await time.increase(DEFAULT_LOCK + 592n);

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

    it("Allows the user to unstake with `exit` for non-locked funds", async () => {
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 2n);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakedAt + 2n],
        [DEFAULT_STAKED_AMOUNT],
        config
      );

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      await contract.connect(stakerA).unstake(DEFAULT_STAKED_AMOUNT, true);
      const unstakedAt = BigInt(await time.latest());

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      // should receive no rewards
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    // also when within lock duration
    // also, when `exit`
    it("Fails when the user tries to exit with less than their full amount staked", async () => {
      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await time.increase (DEFAULT_LOCK / 2n);

      await expect(
        contract.connect(stakerC).unstakeLocked(DEFAULT_STAKED_AMOUNT / 2n, true)
      ).to.be.revertedWithCustomError(contract, NOT_FULL_EXIT_ERR);
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
      try {
        await contract.connect(owner).withdrawLeftoverRewards();
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_CONTRACT_BALANCE_ERR);
      }
    });
  });

  describe("#getStakerData", () => {
    it("Allows a user to get their staking data", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(stakedAt);
      expect(stakerData.unlockedTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Returns zero values for a user that has not staked", async () => {
      const stakerData = await contract.stakers(notStaker.address);

      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(0n);
      expect(stakerData.unlockedTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });
  });

  describe("#getTotalPendingRewards", () => {
    let stakedAt : bigint;
    let stakedAtLocked : bigint;

    it("Allows the user to view the total pending rewards when passed lock time", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      stakedAt = BigInt(await time.latest());

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      stakedAtLocked = BigInt(await time.latest());

      const stakerData = await contract.stakers(stakerA.address);

      const expectedRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        DEFAULT_LOCK,
        true,
        config,
        stakerData.rewardsMultiplier
      );

      const interimRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        BigInt(await time.latest()) - stakedAt,
        false,
        config
      );

      const totalPendingRewards = await contract.connect(stakerA).getPendingRewards();

      // Because we have not passed the time lock, the value of any locked stake is not included in pending rewards
      expect(totalPendingRewards).to.eq(interimRewards);
      expect(stakerData.owedRewardsLocked).to.eq(expectedRewards);
      
      const timeIncrease = 67n;

      const unlockedStakeValue = await contract.getStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        BigInt(await time.latest()) - stakedAt,
        true
      );

      // Time lock + arbitrary additional time
      await time.increase(DEFAULT_LOCK + timeIncrease);

      const interimRewardsAfter = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        BigInt(await time.latest()) - stakedAt,
        false,
        config
      );

      const lockedInterimRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        timeIncrease,
        false,
        config
      );

      const totalPendingRewardsAfter = await contract.connect(stakerA).getPendingRewards();

      expect(totalPendingRewardsAfter).to.eq(expectedRewards + interimRewardsAfter + lockedInterimRewards);
      expect(stakerData.owedRewardsLocked).to.eq(expectedRewards);
    });

    it("Returns 0 for a user that has not staked", async () => {
      const totalPendingRewards = await contract.connect(notStaker).getPendingRewards();
      expect(totalPendingRewards).to.eq(0n);
    });
  });

  describe("Utility functions", () => {
    it("Finds the minimum lock time required to exceed non-locked rewards", async () => {
      await reset();

      // if calcRM function uses 259 base period value, then 30 days is good real min lock time
      const arm = config.minimumLockTime;

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      await contract.connect(stakerB).stakeWithLock(DEFAULT_STAKED_AMOUNT, arm);

      await time.increase(arm);

      const rewardsA = await contract.connect(stakerA).getPendingRewards();
      const rewardsB = await contract.connect(stakerB).getPendingRewards();

      expect(rewardsB).to.be.gt(rewardsA);
    });

    it("Tries to claim when RM is minimal value", async () => {
      await reset();

      await rewardsToken.connect(stakerA).mint(await contract.getAddress(), hre.ethers.parseEther("999999"));

      // await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, 50000n);
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      await contract.connect(stakerB).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_MINIMUM_LOCK);

      // move time to be past the lock duration
      await time.increase(DEFAULT_MINIMUM_LOCK + 1n);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).claim();
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(rewardsBalanceAfter).to.be.gt(rewardsBalanceBefore);
    });
  });

  describe("Different configs", async () => {
    it("Stakes, claims, and unstakes correctly with an entirely different config", async () => {
      // Even though we are manipulating the config here we still reset to be sure all token balances are what we expect
      await reset();

      const localConfig = await createDefaultStakingConfig(
        rewardsToken,
        owner,
        undefined,
        stakeToken,
        stakeRepToken
      );

      localConfig.minimumLockTime = DAY_IN_SECONDS * 54n;
      localConfig.minimumRewardsMultiplier = 234n;
      localConfig.maximumRewardsMultiplier = 799n;
      localConfig.periodLength = DAY_IN_SECONDS * 27n;
      localConfig.rewardsPerPeriod = 123n;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");
      contract = await stakingFactory.deploy(localConfig) as StakingERC20;

      // Fund pool
      await rewardsToken.mint(await contract.getAddress(), hre.ethers.parseEther("999999999"));

      const stakedAmountA = hre.ethers.parseEther("1573");

      await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), await contract.getAddress());
      await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), await contract.getAddress());

      // Give allowance
      await stakeToken.connect(stakerA).approve(await contract.getAddress(), stakedAmountA);

      let stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(0n);

      // Stake
      await contract.connect(stakerA).stakeWithoutLock(stakedAmountA);
      const stakedAtA = BigInt(await time.latest());

      stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStaked).to.eq(stakedAmountA);
      expect(stakerData.lastTimestamp).to.eq(stakedAtA);

      await time.increase(DAY_IN_SECONDS * 4n + 3817n);

      const pendingRewardsA = await contract.connect(stakerA).getPendingRewards();

      const expectedRewardsA = calcStakeRewards(
        stakedAmountA,
        BigInt(await time.latest()) - stakedAtA,
        false,
        localConfig
      );

      expect(pendingRewardsA).to.eq(expectedRewardsA);

      // Claim stake rewards from contract
      const rewardsBalanceBeforeA = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).claim();
      const claimedAtA = BigInt(await time.latest());

      // confirm TS change is correct
      stakerData = await contract.stakers(stakerA.address);
      expect(stakerData.amountStaked).to.eq(stakedAmountA);
      expect(stakerData.owedRewards).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(claimedAtA);

      const expectedClaimA = calcStakeRewards(
        stakedAmountA,
        claimedAtA - stakedAtA,
        false,
        localConfig
      );

      const rewardsBalanceAfterA = await rewardsToken.balanceOf(stakerA.address);

      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA + expectedClaimA);


      // Unstake partial amounts
      const unstakeAmountA = stakedAmountA / 2n;

      // TODO confirm works with full unstake too
      await contract.connect(stakerA).unstake(unstakeAmountA, false);

      const unstakedAtA = BigInt(await time.latest());

      stakerData = await contract.stakers(stakerA.address);
      expect(stakerData.amountStaked).to.eq(stakedAmountA - unstakeAmountA);
      expect(stakerData.lastTimestamp).to.eq(unstakedAtA);

      const rewardsBalanceAfterUnstakeA = await rewardsToken.balanceOf(stakerA.address);

      const expectedRewardsUnstakeA = calcStakeRewards(
        unstakeAmountA,
        unstakedAtA - claimedAtA,
        false,
        localConfig
      );

      expect(rewardsBalanceAfterUnstakeA).to.eq(rewardsBalanceAfterA + expectedRewardsUnstakeA);
    });
  });

  describe("Events", () => {
    let stakedAt : bigint;
    let stakedAtLocked : bigint;
    let claimedAt : bigint;
    let unstakedAt : bigint;

    it("Emits a Staked event when a user stakes without a lock", async () => {
      await reset();

      await expect(
        contract.connect(stakerF).stakeWithoutLock(DEFAULT_STAKED_AMOUNT)
      ).to.emit(contract, STAKED_EVENT)
        .withArgs(stakerF.address, DEFAULT_STAKED_AMOUNT, 0n);

      stakedAt = BigInt(await time.latest());
    });

    it("Emits a Staked event when a user stakes with a lock", async () => {
      await expect(
        contract.connect(stakerF).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK)
      ).to.emit(contract, STAKED_EVENT)
        .withArgs(stakerF.address, DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      stakedAtLocked = BigInt(await time.latest());
    });

    it("Emits a Claimed event when a user claims rewards", async () => {

      await time.increase(DEFAULT_LOCK / 4n);

      const stakeRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        BigInt(await time.latest()) - stakedAt + 2n,
        false,
        config
      );

      await rewardsToken.transfer(
        await contract.getAddress(),
        hre.ethers.parseEther("999999999")
      );

      await expect(
        contract.connect(stakerF).claim()
      ).to.emit(contract, CLAIMED_EVENT)
        .withArgs(stakerF.address, stakeRewards);

      claimedAt = BigInt(await time.latest());
    });

    it("Emits Unstaked and Claimed event when a user unstakes non-locked funds", async () => {
      await time.increase(DEFAULT_LOCK / 2n);

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        hre.ethers.parseEther("999999999")
      );

      const stakerData = await contract.stakers(stakerF.address);

      const rewardsBalance = await rewardsToken.balanceOf(stakerF.address);
      const unstakeAmount = stakerData.amountStaked / 2n;

      await expect(
        contract.connect(stakerF).unstake(unstakeAmount, false)
      ).to.emit(contract, UNSTAKED_EVENT)
        .withArgs(stakerF.address, unstakeAmount);

      unstakedAt = BigInt(await time.latest());

      const stakeRewards = calcStakeRewards(
        unstakeAmount,
        unstakedAt - claimedAt,
        false,
        config
      );

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerF.address);

      expect(rewardsBalanceAfter).to.eq(rewardsBalance + stakeRewards);
    });

    it("Emits an Unstaked event when unstaking locked funds passed the lock period", async () => {
      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      stakedAtLocked = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK);

      const stakerData = await contract.stakers(stakerA.address);

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        hre.ethers.parseEther("999999999")
      );

      await expect(
        contract.connect(stakerA).unstakeLocked(stakerData.amountStakedLocked, false)
      ).to.emit(contract, UNSTAKED_EVENT)
        .withArgs(stakerA.address, stakerData.amountStakedLocked);
    });

    it("Emits an Unstaked event on locked funds when user calls with `exit` as true", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 2n);

      const stakerData = await contract.stakers(stakerA.address);

      const futureExpectedRewards = calcLockedRewards(
        BigInt(await time.latest()) - stakedAt + 2n,
        DEFAULT_STAKED_AMOUNT,
        stakerData.rewardsMultiplier,
        config
      );

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      await expect(
        contract.connect(stakerA).unstakeLocked(stakerData.amountStakedLocked, true)
      ).to.emit(contract, UNSTAKED_EVENT)
        .withArgs(stakerA.address, stakerData.amountStakedLocked);
    });

    it("Emits 'LeftoverRewardsWithdrawn' event when the admin withdraws", async () => {
      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        hre.ethers.parseEther("123")
      );

      const amount = rewardsToken.balanceOf(await contract.getAddress());

      await expect(
        contract.connect(owner).withdrawLeftoverRewards()
      ).to.emit(contract, WITHDRAW_EVENT)
        .withArgs(owner.address, amount);
    });
  });
});
