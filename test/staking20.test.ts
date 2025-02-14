import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { setBalance, time } from "@nomicfoundation/hardhat-network-helpers";
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
  INSUFFICIENT_VALUE_ERR, NON_ZERO_VALUE_ERR,
  CANNOT_EXIT_ERR,
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
  calcStakeRewards,
  DEFAULT_MINIMUM_LOCK,
  getNativeSetupERC20,
  getDefaultERC20Setup,
  fundAndApprove,
  getDefaultERC20SetupWithExit,
  calcUpdatedStakeRewards,
  calcRewardsMultiplier,
} from "./helpers/staking";
import { seconds } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";
import { N } from "ethers";


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
    const stakeRepFactory = await hre.ethers.getContractFactory("ZeroVotingERC20");

    reset = async () => {
      stakeToken = await mockERC20Factory.deploy("MEOW", "MEOW");
      rewardsToken = await mockERC20Factory.deploy("WilderWorld", "WW");
      stakeRepToken = await stakeRepFactory.deploy("VotingToken", "VTKN", "ZERO DAO", "1", owner);

      // Give the owner ample funds for transfers in native token case
      await setBalance(owner.address, INIT_BALANCE * 10n);

      [contract, config] = await getDefaultERC20Setup(
        owner,
        rewardsToken,
        stakeToken,
        stakeRepToken,
      );

      // Give each user funds to stake
      await fundAndApprove(
        owner,
        [
          stakerA,
          stakerB,
          stakerC,
          stakerD,
          stakerF,
        ],
        stakeToken,
        await contract.getAddress(),
      );

      // Give contract the funds to pay rewards
      await rewardsToken.mint(
        await contract.getAddress(),
        hre.ethers.parseEther("999999999")
      )
    };

    await reset();
  });

  describe("#getContractRewardsBalance", () => {
    it("it accounts for balance when rewards and stake are same token", async () => {
      const localContract = await getNativeSetupERC20(owner, stakeRepToken);

      // Provide rewards funding in native token
      await owner.sendTransaction({
        to: await localContract.getAddress(),
        value: hre.ethers.parseEther("9999"),
      });

      const stakeAmount = DEFAULT_STAKED_AMOUNT;
      await localContract.connect(stakerA).stakeWithoutLock(
        stakeAmount,
        {
          value: stakeAmount,
        }
      );

      const totalStaked = await localContract.totalStaked();
      expect(totalStaked).to.eq(stakeAmount);

      const contrRewardsBal = await hre.ethers.provider.getBalance(await localContract.getAddress());
      const contrRewardsBalFromContract = await localContract.getContractRewardsBalance();

      expect(contrRewardsBalFromContract).to.eq(contrRewardsBal - totalStaked);
    });

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

      const stakeValue = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        DEFAULT_LOCK,
        true,
        config,
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

  describe("#unstakeUnlocked", () => {
    it("Allows a user to unstake non-locked amount partially and burns `stakeRepToken`", async () => {
      await reset();

      const amountStaked = DEFAULT_STAKED_AMOUNT;
      await contract.connect(stakerA).stakeWithoutLock(amountStaked);
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

      await contract.connect(stakerA).unstakeUnlocked(unstakeAmount);

      const unstakedAt = BigInt(await time.latest());
      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);

      const stakeRewards = calcStakeRewards(
        amountStaked,
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

      await contract.connect(stakerA).unstakeUnlocked(stakerDataBefore.amountStaked);

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
        contract.connect(stakerA).unstakeUnlocked(0)
      ).to.be.revertedWithCustomError(contract, ZERO_VALUE_ERR);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstakeUnlocked(DEFAULT_STAKED_AMOUNT)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Fails when the user tries to unstake more than they have staked", async () => {
      // Avoid erroring for time lock period
      await time.increase(DEFAULT_LOCK);

      const stakerData = await contract.stakers(stakerC.address);

      await expect(
        contract.connect(stakerC).unstakeLocked(stakerData.amountStakedLocked + 1n)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Fails when there are not enough rewards in the contract", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      await time.increase(DEFAULT_LOCK / 2n);

      const stakerData = await contract.stakers(stakerA.address);

      try {
        await contract.connect(stakerA).unstakeUnlocked(stakerData.amountStaked);
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_BALANCE_ERR);
      }
    });
  });

  describe("#unstakeLocked", () => {
    // eslint-disable-next-line max-len
    it("Allows a user to partially unstake locked funds when passed their lock time and burns `stakeRepToken`", async () => {
      await reset();

      const stakedAmount = DEFAULT_STAKED_AMOUNT;
      await contract.connect(stakerA).stakeWithLock(stakedAmount, DEFAULT_LOCK);
      const stakedAt = BigInt(await time.latest());

      const stakeRewards = calcStakeRewards(
        stakedAmount,
        DEFAULT_LOCK,
        true,
        config,
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

      const amount = stakedAmount / 2n;

      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).unstakeLocked(amount);
      const unstakedAt = BigInt(await time.latest());

      const repTokenBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);

      // should only be 1s more than stakeValue
      const interimRewards = calcStakeRewards(
        stakedAmount,
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

      await contract.connect(stakerA).unstakeLocked(DEFAULT_STAKED_AMOUNT / 2n);

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
        contract.connect(stakerA).unstakeLocked(0)
      ).to.be.revertedWithCustomError(contract, ZERO_VALUE_ERR);
    });

    it("Fails when the user has never staked", async () => {
      await expect(
        contract.connect(notStaker).unstakeLocked(1)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Fails when the user has not passed their lock time", async () => {
      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await expect(
        contract.connect(stakerC).unstakeLocked(DEFAULT_STAKED_AMOUNT)
      ).to.be.revertedWithCustomError(contract, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails when the user tries to unstake more than they have staked", async () => {
      await time.increase(DEFAULT_LOCK);

      const stakerData = await contract.stakers(stakerC.address);

      await expect(
        contract.connect(stakerC).unstakeLocked(stakerData.amountStakedLocked + 1n)
      ).to.be.revertedWithCustomError(contract, UNEQUAL_UNSTAKE_ERR);
    });

    it("Fails when there are not enough rewards in the contract", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK);

      try {
        await contract.connect(stakerA).unstakeLocked(DEFAULT_STAKED_AMOUNT);
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_BALANCE_ERR);
      }
    });
  });

  describe("#exit", () => {
    it("Allows a user to 'exit' within lock duration and burns `stakeRepToken`", async () => {
      await reset();

      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);
      const repTokenBalanceBefore = await stakeRepToken.balanceOf(stakerC.address);

      const stakerDataBefore = await contract.stakers(stakerC.address);

      const unstakeAmount = stakerDataBefore.amountStakedLocked;
      await contract.connect(stakerC).exit(true);

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

    it("Doesn't effect non-locked funds when user fully exits after lock duration", async () => {
      await contract.connect(stakerC).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerC.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

      const stakerDataBefore = await contract.stakers(stakerC.address);

      // Some arbitrary amount of extra time
      await time.increase(DEFAULT_LOCK + 592n);

      await contract.connect(stakerC).exit(true);

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

    it("Allows the user to `exit` for non-locked funds", async () => {
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      await time.increase(DEFAULT_LOCK / 2n);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).exit(false);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      // should receive no rewards
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakerData.amountStaked).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(0n);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Does not fail when there are not enough rewards in the contract", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      const contractBalance = await rewardsToken.balanceOf(await contract.getAddress());

      // Confirm no rewards balance exists on the contract
      expect(contractBalance).to.eq(0n);

      const stakeBalanceBefore = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).exit(true);
      await contract.connect(stakerA).exit(false);

      const stakeBalanceAfter = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + (DEFAULT_STAKED_AMOUNT * 2n));
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
    });

    it("Fails when `canExit` is false", async () => {
      const localContract = await getDefaultERC20SetupWithExit(
        owner,
        rewardsToken,
        stakeToken,
        stakeRepToken,
        false // canExit flag
      );

      await stakeToken.connect(stakerA).approve(await localContract.getAddress(), DEFAULT_STAKED_AMOUNT * 2n);

      await time.increase(DEFAULT_LOCK / 2n);

      // Reverts for locked
      await expect(localContract.connect(stakerA).exit(true)).to.be.revertedWithCustomError(
        localContract, CANNOT_EXIT_ERR
      );

      // Reverts for non-locked
      await expect(localContract.connect(stakerA).exit(false)).to.be.revertedWithCustomError(
        localContract, CANNOT_EXIT_ERR
      );
    });

    it("Succeeds when `canExit` is true", async () => {
      const localContract = await getDefaultERC20SetupWithExit(
        owner,
        rewardsToken,
        stakeToken,
        stakeRepToken,
        true // canExit flag
      );

      await stakeToken.connect(stakerA).approve(await localContract.getAddress(), DEFAULT_STAKED_AMOUNT * 2n);

      await localContract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);
      await localContract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      await time.increase(DEFAULT_LOCK / 2n);

      const stakeTokenBalanceBefore = await stakeToken.balanceOf(stakerA);

      // Succeeds for locked tokens
      await localContract.connect(stakerA).exit(true);

      // Succeeds for locked tokens
      await localContract.connect(stakerA).exit(false);

      const stakeTokenBalanceAfter = await stakeToken.balanceOf(stakerA);

      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + (DEFAULT_STAKED_AMOUNT * 2n));
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

    it("Allows the user to view the total pending rewards when passed lock time", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      stakedAt = BigInt(await time.latest());

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const stakerData = await contract.stakers(stakerA.address);

      const expectedRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        DEFAULT_LOCK,
        true,
        config,
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

  describe("Other configs", async () => {
    it("Stakes, claims, partially and fully unstakes when stake and reward token are chain token", async () => {
      // When neither erc20 or erc721 specified we assume erc20 with native token
      const localContract = await getNativeSetupERC20(
        owner,
        stakeRepToken
      );

      const userBalBefore = await hre.ethers.provider.getBalance(stakerA.address);
      const contrBalBefore = await hre.ethers.provider.getBalance(await localContract.getAddress());

      // #stake
      const stakeAmount = DEFAULT_STAKED_AMOUNT;
      const stakeTx = await localContract.connect(stakerA).stakeWithoutLock(
        stakeAmount,
        {
          value: stakeAmount,
        }
      );
      const stakedAt = BigInt(await time.latest());

      const receipt = await stakeTx.wait();

      const userBalAfter = await hre.ethers.provider.getBalance(stakerA.address);
      const contrBalAfter = await hre.ethers.provider.getBalance(await localContract.getAddress());

      expect(userBalAfter).to.eq(userBalBefore - stakeAmount - (receipt!.gasUsed * receipt!.gasPrice));
      expect(contrBalAfter).to.eq(contrBalBefore + stakeAmount);

      await time.increase(DEFAULT_LOCK / 2n);

      const rewardsBefore = await hre.ethers.provider.getBalance(stakerA.address);
      const contrRewardsBalBefore = await hre.ethers.provider.getBalance(await localContract.getAddress());
      const contrRewardsBalBeforeFromContract = await localContract.getContractRewardsBalance();

      // If `stakingToken` and `rewardsToken` are the same, we subtract the difference when checking
      // the balance. Verify this here.
      expect(contrRewardsBalBeforeFromContract).to.eq(contrRewardsBalBefore - await localContract.totalStaked());

      // #claim
      const claimTx = await localContract.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const claimReceipt = await claimTx.wait();

      const rewardsAfter = await hre.ethers.provider.getBalance(stakerA.address);
      const contrRewardsBalAfter = await hre.ethers.provider.getBalance(await localContract.getAddress());
      const contrRewardsBalAfterFromContract = await localContract.getContractRewardsBalance();

      const totalStaked = await localContract.totalStaked();
      expect(contrRewardsBalAfterFromContract).to.eq(contrRewardsBalAfter - totalStaked);

      const stakeRewards = calcStakeRewards(
        DEFAULT_STAKED_AMOUNT,
        claimedAt - stakedAt,
        false,
        config
      );

      expect(rewardsAfter).to.eq(
        rewardsBefore + stakeRewards - (claimReceipt!.gasUsed * claimReceipt!.gasPrice)
      );
      expect(contrRewardsBalAfter).to.eq(contrRewardsBalBefore - stakeRewards);

      await time.increase(DEFAULT_LOCK / 2n);

      // Partial unstake
      const stakerData = await localContract.stakers(stakerA.address);
      const unstakeAmount = stakerData.amountStaked / 2n;

      const rewardsBeforeUnstake = await hre.ethers.provider.getBalance(stakerA.address);

      // partial unstake
      const partialUnstakeTx = await localContract.connect(stakerA).unstakeUnlocked(unstakeAmount);
      const unstakedAt = BigInt(await time.latest());

      const partialUnstakeReceipt = await partialUnstakeTx.wait();

      const stakerDataAfter = await localContract.stakers(stakerA.address);

      const rewardsAfterUnstake = await hre.ethers.provider.getBalance(stakerA.address);

      const stakeRewardsUnstake = calcStakeRewards(
        stakeAmount,
        unstakedAt - claimedAt,
        false,
        config
      );

      expect(stakerDataAfter.amountStaked).to.eq(stakeAmount - unstakeAmount);
      expect(rewardsAfterUnstake).to.eq(
        rewardsBeforeUnstake + unstakeAmount + stakeRewardsUnstake
        - (partialUnstakeReceipt!.gasPrice * partialUnstakeReceipt!.gasUsed)
      );

      // # full unstake
      const fullUnstakeTx = await localContract.connect(stakerA).unstakeUnlocked(stakerDataAfter.amountStaked);
      const fullUnstakedAt = BigInt(await time.latest());

      const stakerDataAfterFull = await localContract.stakers(stakerA.address);

      const stakeRewardsFullnstake = calcStakeRewards(
        stakerDataAfter.amountStaked,
        fullUnstakedAt - unstakedAt,
        false,
        config
      );

      const rewardsAfterFullUnstake = await hre.ethers.provider.getBalance(stakerA.address);

      const fullUnstakeReceipt = await fullUnstakeTx.wait();

      expect(await localContract.totalStaked()).to.eq(0n);
      expect(stakerDataAfterFull.amountStaked).to.eq(0n);
      expect(stakerDataAfterFull.owedRewards).to.eq(0n);

      expect(rewardsAfterFullUnstake).to.eq(
        rewardsAfterUnstake + stakerDataAfter.amountStaked + stakeRewardsFullnstake
        - (fullUnstakeReceipt!.gasPrice * fullUnstakeReceipt!.gasUsed)
      );
    });

    it("Fails when using native token and `amount` does not equal `msg.value`", async () => {
      const localContract = await getNativeSetupERC20(
        owner,
        stakeRepToken
      );

      await expect(
        localContract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT,
          {
            value: DEFAULT_STAKED_AMOUNT - 1n,
          }
        )
      ).to.be.revertedWithCustomError(contract, INSUFFICIENT_VALUE_ERR);
    });

    it("Stakes, claims, and unstakes correctly with an entirely different config", async () => {
      // Even though we are manipulating the config here we still reset to be sure all token balances are what we expect
      await reset();

      const localConfig = await createDefaultStakingConfig(
        owner,
        rewardsToken,
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
      await contract.connect(stakerA).unstakeUnlocked(unstakeAmountA);

      const unstakedAtA = BigInt(await time.latest());

      stakerData = await contract.stakers(stakerA.address);
      expect(stakerData.amountStaked).to.eq(stakedAmountA - unstakeAmountA);
      expect(stakerData.lastTimestamp).to.eq(unstakedAtA);

      const rewardsBalanceAfterUnstakeA = await rewardsToken.balanceOf(stakerA.address);

      const expectedRewardsUnstakeA = calcStakeRewards(
        stakedAmountA,
        unstakedAtA - claimedAtA,
        false,
        localConfig
      );

      expect(rewardsBalanceAfterUnstakeA).to.eq(rewardsBalanceAfterA + expectedRewardsUnstakeA);
    });
  });

  describe("Events", () => {
    let stakedAt : bigint;
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
        contract.connect(stakerF).unstakeUnlocked(unstakeAmount)
      ).to.emit(contract, UNSTAKED_EVENT)
        .withArgs(stakerF.address, unstakeAmount);

      unstakedAt = BigInt(await time.latest());

      const stakeRewards = calcStakeRewards(
        stakerData.amountStaked,
        unstakedAt - claimedAt,
        false,
        config
      );

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerF.address);

      expect(rewardsBalanceAfter).to.eq(rewardsBalance + stakeRewards);
    });

    it("Emits an Unstaked event when unstaking locked funds passed the lock period", async () => {
      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK);

      const stakerData = await contract.stakers(stakerA.address);

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        hre.ethers.parseEther("999999999")
      );

      await expect(
        contract.connect(stakerA).unstakeLocked(stakerData.amountStakedLocked)
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

  describe("Audit fixes", () => {
    it("Should use proper `rewardsMultiplier` when adding to an existing locked stake", async () => {
      await reset();

      const stakeAmtInitial = hre.ethers.parseEther("137");
      const lockTime = DAY_IN_SECONDS * 112n;

      await contract.connect(stakerA).stakeWithLock(stakeAmtInitial, lockTime);

      // leave 2 days before end of lock period
      await time.increase(lockTime - DAY_IN_SECONDS * 2n);

      const stakeAmtAdd = hre.ethers.parseEther("73");
      // the `lockTime` value passed to `stakeWithLock` below should NOT be taken into account on the contract
      await contract.connect(stakerA).stakeWithLock(stakeAmtAdd, lockTime);

      const totalStakedAmt = stakeAmtInitial + stakeAmtAdd;

      // fund contract with the exact amount of rewards that should be owed
      const expectedRewardsInitial = calcStakeRewards(
        stakeAmtInitial,
        lockTime,
        true,
        config,
      );

      const remainingLockTime = await contract.connect(stakerA).getRemainingLockTime();
      const expectedRewardsAdd = calcStakeRewards(
        stakeAmtAdd,
        remainingLockTime,
        true,
        config,
      );

      const extraTime = 73n;
      await time.increase(remainingLockTime + extraTime);

      const extraTimeRewards = calcStakeRewards(
        stakeAmtInitial + stakeAmtAdd,
        extraTime + 2n,
        false,
        config
      );

      const totalRewardsRef = expectedRewardsInitial + expectedRewardsAdd + extraTimeRewards;

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        totalRewardsRef
      );

      const rewardBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      // unstake to get rewards
      await contract.connect(stakerA).unstakeLocked(totalStakedAmt);
      const rewardBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      expect(rewardBalanceAfter - rewardBalanceBefore).to.eq(totalRewardsRef);
    });

    it("Should revert when sending gas token with ERC20 stake", async () => {
      // without lock
      await expect(
        contract.stakeWithoutLock(DEFAULT_STAKED_AMOUNT, { value: DEFAULT_STAKED_AMOUNT })
      ).to.be.revertedWithCustomError(contract, NON_ZERO_VALUE_ERR);

      // with lock
      await expect(
        contract.stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK, { value: DEFAULT_STAKED_AMOUNT })
      ).to.be.revertedWithCustomError(contract, NON_ZERO_VALUE_ERR);
    });

    it("6.4 - User loses rewards when unstaking partial amounts", async () => {
      await reset();

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DAY_IN_SECONDS * 37n);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      // 6.4 - Note we are calculating expected rewards with their ENTIRE balance
      const futureExpectedRewards = calcTotalUnlockedRewards(
        [BigInt(await time.latest()) - stakedAt + 2n],
        [stakerData.amountStaked],
        config
      );

      await rewardsToken.connect(owner).transfer(
        await contract.getAddress(),
        futureExpectedRewards
      );

      // Partial unstake
      const unstakeAmount = DEFAULT_STAKED_AMOUNT / 2n;
      await contract.connect(stakerA).unstakeUnlocked(unstakeAmount);

      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      // Confirm that the expected rewards calculated using their FULL staked amount is accurate
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + futureExpectedRewards);
    });
  });

  // 6.3 AUDIT
  describe.only("6.3 -  Staking parameters change impact past rewards computations", () => {
    beforeEach(async () => {
      await reset();
    })
    
    it("6.3 Preliminary - No config changes, confirm helper and contract code return same rewards value", async () => {
      // After changing the code for rewards to account for config changes in the past
      // we want to make sure that the typescript helper code returns the same value
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      await time.increase(DAY_IN_SECONDS * 21n);

      const stakerData = await contract.stakers(stakerA.address);

      const rewardsFromHelper = await calcUpdatedStakeRewards(
        stakerData.lastTimestamp,
        DEFAULT_STAKED_AMOUNT,
        false,
        [config]
      )

      const rewardsFromContract = await contract.getStakeRewards(
        stakerData.lastTimestamp,
        DEFAULT_STAKED_AMOUNT,
        false
      )

      expect(rewardsFromHelper).to.eq(rewardsFromContract);
    });

    it("6.3 - one unlocked stake, one config change", async () => {
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      await time.increase(DAY_IN_SECONDS * 104n);

      // Set new config
      const newConfig = { ...config };
      newConfig.canExit = !config.canExit;
      newConfig.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(newConfig);

      // Confirm the config change
      expect(await contract.canExit()).to.eq(newConfig.canExit);

      await time.increase(DAY_IN_SECONDS * 55n);

      const stakerDataBefore = await contract.stakers(stakerA.address);

      // Claim and check reward balance is accurate
      const beforeClaim = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const afterClaim = await rewardsToken.balanceOf(stakerA.address);

      const rewardsFromHelper = await calcUpdatedStakeRewards(
        stakerDataBefore.lastTimestamp,
        DEFAULT_STAKED_AMOUNT,
        false,
        [config, newConfig]
      )

      const rewardsFromContract = await contract.getStakeRewards(
        stakerDataBefore.lastTimestamp,
        DEFAULT_STAKED_AMOUNT,
        false
      )

      // To account for a rounding error in solidity math for + 1n
      // that causes a difference in our test helper here
      expect(rewardsFromHelper).to.satisfy((rewards: bigint) => {
        return rewards === rewardsFromContract || rewards === rewardsFromContract + 1n
      });
      expect(afterClaim).to.eq(beforeClaim + rewardsFromContract);

      await time.increase(DAY_IN_SECONDS * 102n);

      const stakerDataAfter = await contract.stakers(stakerA.address);

      // Partial unstake
      const beforePartial = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeUnlocked(stakerDataAfter.amountStaked / 3n);
      const afterPartial = await rewardsToken.balanceOf(stakerA.address);

      const partialRewards = await calcUpdatedStakeRewards(
        stakerDataAfter.lastTimestamp,
        stakerDataAfter.amountStaked,
        false,
        [config, newConfig]
      )

      expect(afterPartial).to.eq(beforePartial + partialRewards);

      const stakerDataAfterPartial = await contract.stakers(stakerA.address);

      // Full unstake
      const beforeFull = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeUnlocked(stakerDataAfterPartial.amountStaked);
      const afterFull = await rewardsToken.balanceOf(stakerA.address);

      const fullRewards = await calcUpdatedStakeRewards(
        stakerDataAfterPartial.lastTimestamp,
        stakerDataAfterPartial.amountStaked,
        false,
        [config, newConfig]
      )

      expect(afterFull).to.eq(beforeFull + fullRewards);
    })

    it("6.3 - one locked stake, one config change before stake unlocks", async () => {
      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const lockedRewards = await calcUpdatedStakeRewards(
        DEFAULT_LOCK,
        DEFAULT_STAKED_AMOUNT,
        true,
        [config]
      );

      await time.increase(DEFAULT_LOCK / 2n);

      // Add config change BEFORE lock duration is up
      const newConfig = { ...config };
      newConfig.maximumRewardsMultiplier = config.maximumRewardsMultiplier * 2n;
      newConfig.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(config);

      // Move time forward beyond lock duration
      await time.increase(DEFAULT_LOCK / 2n + DAY_IN_SECONDS * 37n);

      const stakerDataBefore = await contract.stakers(stakerA.address);

      // Claim and check reward balance is accurate
      const beforeClaim = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());
      const afterClaim = await rewardsToken.balanceOf(stakerA.address);

      const interimFromHelper = await calcUpdatedStakeRewards(
        stakerDataBefore.unlockedTimestamp,
        DEFAULT_STAKED_AMOUNT,
        false,
        [config, newConfig]
      )

      const interimFromContract = await contract.getStakeRewards(
        stakerDataBefore.unlockedTimestamp,
        DEFAULT_STAKED_AMOUNT,
        false
      )

      expect(interimFromHelper).to.eq(interimFromContract);
      expect(afterClaim).to.eq(beforeClaim + lockedRewards + interimFromContract);

      await time.increase(DAY_IN_SECONDS * 12n);

      const stakerDataAfter = await contract.stakers(stakerA.address);

      // Full unstake
      const beforeFull = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeLocked(stakerDataAfter.amountStakedLocked);
      const afterFull = await rewardsToken.balanceOf(stakerA.address);

      const fullRewards = await calcUpdatedStakeRewards(
        stakerDataAfter.lastTimestampLocked,
        stakerDataAfter.amountStakedLocked,
        false,
        [config, newConfig]
      )

      expect(afterFull).to.eq(beforeFull + fullRewards);
    })

    it("6.3 - one locked stake, one config change after stake unlocks", async () => {
      // Create time after deployment before we stake
      await time.increase(DAY_IN_SECONDS); 

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const lockedRewards = await calcUpdatedStakeRewards(
        DEFAULT_LOCK,
        DEFAULT_STAKED_AMOUNT,
        true,
        [config]
      );

      await time.increase(DEFAULT_LOCK + DAY_IN_SECONDS * 48n);

      // Add config change AFTER lock duration is up
      let newConfig = { ...config };
      newConfig.rewardsPerPeriod = config.rewardsPerPeriod / 3n;
      newConfig.timestamp = BigInt(await time.latest()) + 1n; // + 1n for automine
      
      await contract.connect(owner).setConfig(newConfig);

      // Confirm change
      expect(await contract.getRewardsPerPeriod()).to.eq(newConfig.rewardsPerPeriod);

      await time.increase(DAY_IN_SECONDS * 12n);

      const stakerDataBefore = await contract.stakers(stakerA.address);

      // Claim and check reward balance is accurate
      const beforeClaim = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const afterClaim = await rewardsToken.balanceOf(stakerA.address);

      const interimFromHelper = await calcUpdatedStakeRewards(
        stakerDataBefore.unlockedTimestamp,
        DEFAULT_STAKED_AMOUNT,
        false,
        [config, newConfig]
      )

      // but this is correct when compared to amount changed
      const interimFromContract = await contract.getStakeRewards(
        stakerDataBefore.unlockedTimestamp,
        DEFAULT_STAKED_AMOUNT,
        false
      )

      expect(interimFromHelper).to.eq(interimFromContract);
      expect(afterClaim).to.eq(beforeClaim + lockedRewards + interimFromContract);

      const stakerDataAfter = await contract.stakers(stakerA.address);


      // Full unstake
      const beforeFull = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeLocked(stakerDataAfter.amountStakedLocked);
      const afterFull = await rewardsToken.balanceOf(stakerA.address);

      const fullRewards = await calcUpdatedStakeRewards(
        stakerDataAfter.lastTimestampLocked,
        stakerDataAfter.amountStakedLocked,
        false,
        [config, newConfig]
      )

      expect(afterFull).to.eq(beforeFull + fullRewards);
    })

    it("6.3 - one unlocked stake, two config changes", async () => {
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DAY_IN_SECONDS * 9n);

      const configA = { ...config };
      configA.minimumLockTime = config.minimumLockTime / 2n;
      configA.maximumRewardsMultiplier = config.maximumRewardsMultiplier * 2n;
      configA.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(configA);

      // Confirm change
      expect(await contract.getMinimumLockTime()).to.eq(configA.minimumLockTime);
      expect(await contract.getMaximumRewardsMultiplier()).to.eq(configA.maximumRewardsMultiplier);

      await time.increase(DAY_IN_SECONDS * 35n);

      const configB = { ...configA }
      configB.periodLength = configA.periodLength / 3n;
      configB.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(configB);

      expect(await contract.getPeriodLength()).to.eq(configB.periodLength);

      await time.increase(DAY_IN_SECONDS * 17n);
      
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      const rewardsFromHelper = await calcUpdatedStakeRewards(
        stakedAt,
        DEFAULT_STAKED_AMOUNT,
        false,
        [config, configA, configB]
      )

      const rewardsFromContract = await contract.getStakeRewards(
        stakedAt,
        DEFAULT_STAKED_AMOUNT,
        false
      )

      expect(rewardsFromHelper).to.eq(rewardsFromContract);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + rewardsFromContract);

      // Partial unstake
      const stakerData = await contract.stakers(stakerA.address);

      const beforePartial = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeUnlocked(stakerData.amountStaked / 2n);
      const afterPartial = await rewardsToken.balanceOf(stakerA.address);

      const partialRewards = await calcUpdatedStakeRewards(
        stakerData.lastTimestamp,
        stakerData.amountStaked, // Full balance for reward calcs
        false,
        [config, configA, configB]
      )

      expect(afterPartial).to.eq(beforePartial + partialRewards);

      const stakerDataAfter = await contract.stakers(stakerA.address);

      // Full unstake
      const beforeFull = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeUnlocked(stakerDataAfter.amountStaked);
      const afterFull = await rewardsToken.balanceOf(stakerA.address);

      const fullRewards = await calcUpdatedStakeRewards(
        stakerDataAfter.lastTimestamp,
        stakerDataAfter.amountStaked,
        false,
        [config, configA, configB]
      )

      expect(afterFull).to.eq(beforeFull + fullRewards);
    })

    it("6.3 - two unlocked stakes, two config changes", async () => {
      // New config change before staking
      const configA = { ...config };
      configA.canExit = !config.canExit;
      configA.rewardsPerPeriod = config.rewardsPerPeriod + 18n;
      configA.timestamp = BigInt(await time.latest()) + 1n
      await contract.connect(owner).setConfig(configA);

      expect (await contract.getRewardsPerPeriod()).to.eq(configA.rewardsPerPeriod);
      
      await time.increase(DAY_IN_SECONDS * 4n);

      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);
      const firstStakedAt = BigInt(await time.latest());

      await time.increase(DAY_IN_SECONDS * 12n);

      // Partial unstake
      const stakerDataPartial = await contract.stakers(stakerA.address);

      const beforePartial = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeUnlocked(stakerDataPartial.amountStaked / 2n);
      const partialUnstakedAt = BigInt(await time.latest());
      const afterPartial = await rewardsToken.balanceOf(stakerA.address);

      const partialRewards = await calcUpdatedStakeRewards(
        stakerDataPartial.lastTimestamp, // first stakedAt
        stakerDataPartial.amountStaked, // default_staked_amount
        false,
        [config, configA]
      )

      expect(afterPartial).to.eq(beforePartial + partialRewards);

      await time.increase(DAY_IN_SECONDS * 71n);

      expect((await contract.stakers(stakerA.address)).owedRewards).to.eq(0n);

      // Stake again after first config change
      await contract.connect(stakerA).stakeWithoutLock(DEFAULT_STAKED_AMOUNT);

      const secondStakedAt = BigInt(await time.latest());

      const stakerData = await contract.stakers(stakerA.address);

      // Rewards between first and second stakes
      const inBetweenRewards = await calcUpdatedStakeRewards(
        partialUnstakedAt,
        DEFAULT_STAKED_AMOUNT / 2n,
        false,
        [config, configA]
      )

      // Rewards were tallied before additional stake was added to balance
      expect(stakerData.owedRewards).to.eq(inBetweenRewards);

      await time.increase(DAY_IN_SECONDS * 22n);

      const configB = { ...configA };
      configB.periodLength = configA.periodLength / 3n;
      configB.rewardsPerPeriod = configA.rewardsPerPeriod * 5n;
      configB.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(configB);

      expect(await contract.getPeriodLength()).to.eq(configB.periodLength);
      expect(await contract.getRewardsPerPeriod()).to.eq(configB.rewardsPerPeriod);

      await time.increase(DAY_IN_SECONDS * 197n);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

      const rewardsFromHelper = await calcUpdatedStakeRewards(
        secondStakedAt,
        stakerData.amountStaked,
        false,
        [config, configA, configB]
      )

      const rewardsFromContract = await contract.getStakeRewards(
        secondStakedAt,
        stakerData.amountStaked,
        false
      )

      expect(rewardsFromHelper).to.eq(rewardsFromContract);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + rewardsFromContract + inBetweenRewards);

      // Full unstake
      const stakerDataFull = await contract.stakers(stakerA.address);

      const beforeFull = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeUnlocked(stakerDataFull.amountStaked);
      const afterFull = await rewardsToken.balanceOf(stakerA.address);

      const fullRewards = await calcUpdatedStakeRewards(
        stakerDataFull.lastTimestamp,
        stakerDataFull.amountStaked,
        false,
        [config, configA, configB]
      )

      expect(afterFull).to.eq(beforeFull + fullRewards);
    })

    it("6.3 - two locked stakes, two config chages, one before and one after it unlocks", async () => {
      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const lockedRewards = await calcUpdatedStakeRewards(
        DEFAULT_LOCK,
        DEFAULT_STAKED_AMOUNT,
        true,
        [config]
      )

      await time.increase(DEFAULT_LOCK / 4n);

      // Config change while still locked
      const configA = { ...config };
      configA.rewardsPerPeriod = config.rewardsPerPeriod / 2n;
      configA.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(configA);

      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      const remainingLockTime = await contract.connect(stakerA).getRemainingLockTime();

      const addedLockedRewards = await calcUpdatedStakeRewards(
        remainingLockTime,
        DEFAULT_STAKED_AMOUNT,
        true,
        [configA]
      )

      await time.increase(DEFAULT_LOCK + DAY_IN_SECONDS * 2n);

      // Config change while unlocked and collecting interim rewards
      const configB = { ...configA };
      configB.minimumLockTime = configA.minimumLockTime * 4n;
      configB.rewardsPerPeriod = 132n;
      configB.periodLength = configA.periodLength * 12n;
      configB.timestamp = BigInt(await time.latest()) + 1n;

      await contract.connect(owner).setConfig(configB);

      expect(await contract.getMinimumLockTime()).to.eq(configB.minimumLockTime);
      expect(await contract.getRewardsPerPeriod()).to.eq(configB.rewardsPerPeriod);
      expect(await contract.getPeriodLength()).to.eq(configB.periodLength);

      await time.increase(DAY_IN_SECONDS * 17n);

      const stakerData = await contract.stakers(stakerA.address);
      
      // Claim
      const balanceBefore = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const balanceAfter = await rewardsToken.balanceOf(stakerA.address);

      const interimFromHelper = await calcUpdatedStakeRewards(
        stakerData.unlockedTimestamp,
        stakerData.amountStakedLocked,
        false,
        [
          config,
          configA,
          configB
        ]
      )

      const interimFromContract = await contract.getStakeRewards(
        stakerData.unlockedTimestamp,
        stakerData.amountStakedLocked,
        false
      )

      expect(interimFromHelper).to.eq(interimFromContract);
      expect(balanceAfter).to.eq(
        balanceBefore + lockedRewards + addedLockedRewards + interimFromHelper
      );

      await time.increase(DAY_IN_SECONDS * 193n);

      const stakerDataFull = await contract.stakers(stakerA.address);

      // Full unstake
      const beforeFull = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeLocked(stakerData.amountStakedLocked);
      const afterFull = await rewardsToken.balanceOf(stakerA.address);

      const fullRewards = await calcUpdatedStakeRewards(
        stakerDataFull.lastTimestampLocked,
        stakerDataFull.amountStakedLocked,
        false,
        [config, configA, configB]
      )

      expect(afterFull).to.eq(beforeFull + fullRewards);
    })

    it("6.3 - one unlocked and one locked stake that unlocks, with claims in between, two config changes", async () => {
      await contract.connect(stakerA).stakeWithLock(DEFAULT_STAKED_AMOUNT, DEFAULT_LOCK);

      // Locked rewards are precalculated using the current config
      const lockedRewards = await calcUpdatedStakeRewards(
        DEFAULT_LOCK,
        DEFAULT_STAKED_AMOUNT,
        true,
        [config]
      )

      await time.increase(DEFAULT_LOCK / 4n)

      const unlockedStakedAmount = DEFAULT_STAKED_AMOUNT / 3n;
      await contract.connect(stakerA).stakeWithoutLock(unlockedStakedAmount);
      const stakedAtUnlocked = BigInt(await time.latest());

      const stakerDataBefore = await contract.stakers(stakerA.address);
      expect(stakerDataBefore.owedRewardsLocked).to.eq(lockedRewards);
      expect(stakerDataBefore.owedRewards).to.eq(0n);

      await time.increase(DEFAULT_LOCK + DAY_IN_SECONDS * 13n);

      // Config change while still locked
      const configA = { ...config };
      configA.rewardsPerPeriod = config.rewardsPerPeriod / 2n;
      configA.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(configA);

      await time.increase(DEFAULT_LOCK / 4n);

      // Setting a new config did not change amount owed for a stake that is still locked
      const stakerDataAfterConfigA = await contract.stakers(stakerA.address);
      expect(stakerDataAfterConfigA.owedRewardsLocked).to.eq(stakerDataBefore.owedRewardsLocked);

      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const rewardsBalanceAfterFirst = await rewardsToken.balanceOf(stakerA.address);

      const rewardsUnlocked = await calcUpdatedStakeRewards(
        stakedAtUnlocked,
        unlockedStakedAmount,
        false,
        [config, configA]
      )

      const interimRewardsA = await calcUpdatedStakeRewards(
        stakerDataAfterConfigA.unlockedTimestamp,
        DEFAULT_STAKED_AMOUNT,
        false,
        [config, configA]
      )

      expect(rewardsBalanceAfterFirst).to.eq(
        rewardsBalanceBefore + rewardsUnlocked + interimRewardsA + lockedRewards
      );

      await time.increase(DAY_IN_SECONDS * 54n);

      // partial unlocked unstake
      const stakerDataPartial = await contract.stakers(stakerA.address);

      const beforePartial = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeUnlocked(stakerDataPartial.amountStaked / 2n);
      const afterPartial = await rewardsToken.balanceOf(stakerA.address);

      const rewardsPartial = await calcUpdatedStakeRewards(
        stakerDataPartial.lastTimestamp,
        stakerDataPartial.amountStaked,
        false,
        [config, configA]
      )

      // maybe off by 1?
      expect(afterPartial).to.eq(beforePartial + rewardsPartial);

      await time.increase(DAY_IN_SECONDS * 2n);

      // Config change while unlocked and collecting interim rewards
      const configB = { ...configA };
      configB.periodLength = configA.periodLength / 3n;
      configB.rewardsPerPeriod = configA.rewardsPerPeriod * 5n;
      configB.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(configB);

      await time.increase(DAY_IN_SECONDS * 17n);

      const stakerDataAfterConfigB = await contract.stakers(stakerA.address);

      const balanceBefore = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const balanceAfter = await rewardsToken.balanceOf(stakerA.address);

      const unlockedRewards = await calcUpdatedStakeRewards(
        stakerDataAfterConfigB.lastTimestamp,
        stakerDataAfterConfigB.amountStaked,
        false,
        [config, configA, configB]
      )

      const interimRewardsB = await calcUpdatedStakeRewards(
        stakerDataAfterConfigB.lastTimestampLocked,
        stakerDataAfterConfigB.amountStakedLocked,
        false,
        [config, configA, configB]
      )

      expect(balanceAfter).to.eq(balanceBefore + unlockedRewards + interimRewardsB);

      await time.increase(DAY_IN_SECONDS * 17n);

      const stakerDataAfterClaim = await contract.stakers(stakerA.address);

      // Full unlocked unstake
      const beforeFullUnlocked = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeUnlocked(stakerDataAfterClaim.amountStaked);
      const afterFullUnlocked = await rewardsToken.balanceOf(stakerA.address);

      const fullRewardsUnlocked = await calcUpdatedStakeRewards(
        stakerDataAfterClaim.lastTimestamp,
        stakerDataAfterClaim.amountStaked,
        false,
        [config, configA, configB]
      )

      expect(afterFullUnlocked).to.eq(beforeFullUnlocked + fullRewardsUnlocked);

      const beforeFullLocked = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeLocked(stakerDataAfterClaim.amountStakedLocked);
      const afterFullLocked = await rewardsToken.balanceOf(stakerA.address);

      const fullRewardsLocked = await calcUpdatedStakeRewards(
        stakerDataAfterClaim.lastTimestampLocked,
        stakerDataAfterClaim.amountStakedLocked,
        false,
        [config, configA, configB]
      )

      expect(afterFullLocked).to.eq(beforeFullLocked + fullRewardsLocked);
    })

    it("6.3 - unlocked and lcoked stakes, claims, stakes again, unstakes, with two changes", async () => {
      const stakedAmountLocked = DEFAULT_STAKED_AMOUNT;
      await contract.connect(stakerA).stakeWithLock(stakedAmountLocked, DEFAULT_LOCK);

      const stakedAmountUnlocked = DEFAULT_STAKED_AMOUNT / 3n;
      await contract.connect(stakerA).stakeWithoutLock(stakedAmountUnlocked);

      // Locked rewards are precalculated using the current config
      const lockedRewards = await calcUpdatedStakeRewards(
        DEFAULT_LOCK,
        DEFAULT_STAKED_AMOUNT,
        true,
        [config]
      )

      const stakerDataBefore = await contract.stakers(stakerA.address);
      expect(stakerDataBefore.owedRewardsLocked).to.eq(lockedRewards);
      expect(stakerDataBefore.owedRewards).to.eq(0n);

      await time.increase(DEFAULT_LOCK / 4n);

      // Config change while still locked
      const configA = { ...config };
      configA.rewardsPerPeriod = config.rewardsPerPeriod / 2n;
      configA.minimumLockTime = config.minimumLockTime * 2n;
      configA.periodLength = config.periodLength * 3n;
      configA.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(configA);

      await time.increase(DEFAULT_LOCK / 4n);

      // Setting a new config did not change amount owed for a stake that is still locked
      const stakerDataAfter = await contract.stakers(stakerA.address);
      expect(stakerDataAfter.owedRewardsLocked).to.eq(stakerDataBefore.owedRewardsLocked);

      const stakerBeforeClaimA = await contract.stakers(stakerA.address);
      const beforeClaimA = await rewardsToken.balanceOf(stakerA.address);
      // Call `claim` before lock is finished, only get rewards from unlocked stake
      await contract.connect(stakerA).claim();
      const afterClaimA = await rewardsToken.balanceOf(stakerA.address);

      const rewardsUnlocked = await calcUpdatedStakeRewards(
        stakerBeforeClaimA.lastTimestamp,
        stakerBeforeClaimA.amountStaked,
        false,
        [config, configA]
      )

      // first staked is still locked, so we receive no rewards from that
      expect(afterClaimA).to.eq(beforeClaimA + rewardsUnlocked);

      await time.increase(DEFAULT_LOCK / 2n + DAY_IN_SECONDS * 2n);

      const stakerBeforeClaimB = await contract.stakers(stakerA.address);
      const beforeClaimB = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).claim();
      const afterClaimB = await rewardsToken.balanceOf(stakerA.address);

      const interimRewardsB = await calcUpdatedStakeRewards(
        stakerBeforeClaimB.unlockedTimestamp,
        stakerBeforeClaimB.amountStakedLocked,
        false,
        [config, configA]
      )

      const rewardsUnlockedB = await calcUpdatedStakeRewards(
        stakerBeforeClaimB.lastTimestamp,
        stakerBeforeClaimB.amountStaked,
        false,
        [config, configA]
      )

      expect(afterClaimB).to.eq(beforeClaimB + lockedRewards + rewardsUnlockedB + interimRewardsB);

      // Config change while unlocked and collecting interim rewards
      const configB = { ...configA };
      configB.periodLength = configA.periodLength * 8n;
      configB.rewardsPerPeriod = configA.rewardsPerPeriod * 3n;
      configB.timestamp = BigInt(await time.latest()) + 1n;
      await contract.connect(owner).setConfig(configB);

      expect(await contract.getPeriodLength()).to.eq(configB.periodLength);
      expect(await contract.getRewardsPerPeriod()).to.eq(configB.rewardsPerPeriod);

      await time.increase(DAY_IN_SECONDS * 17n);

      // partial locked unstake
      const stakerDataPartial = await contract.stakers(stakerA.address);

      const beforePartial = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeLocked(stakerDataPartial.amountStakedLocked / 4n);
      const afterPartial = await rewardsToken.balanceOf(stakerA.address);

      const rewardsPartial = await calcUpdatedStakeRewards(
        stakerDataPartial.lastTimestampLocked,
        stakerDataPartial.amountStakedLocked,
        false,
        [config, configA, configB]
      )

      expect(afterPartial).to.eq(beforePartial + rewardsPartial);

      // full unlocked unstake
      const stakerDataFull = await contract.stakers(stakerA.address);

      const beforeFull = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeUnlocked(stakerDataFull.amountStaked);
      const afterFull = await rewardsToken.balanceOf(stakerA.address);

      const fullRewards = await calcUpdatedStakeRewards(
        stakerDataFull.lastTimestamp,
        stakerDataFull.amountStaked,
        false,
        [config, configA, configB]
      )

      expect(afterFull).to.eq(beforeFull + fullRewards);

      // full locked unstake
      const beforeFullLocked = await rewardsToken.balanceOf(stakerA.address);
      await contract.connect(stakerA).unstakeLocked(stakerDataFull.amountStakedLocked);
      const afterFullLocked = await rewardsToken.balanceOf(stakerA.address);

      const fullRewardsLocked = await calcUpdatedStakeRewards(
        stakerDataFull.lastTimestampLocked,
        stakerDataFull.amountStakedLocked,
        false,
        [config, configA, configB]
      )

      expect(afterFullLocked).to.eq(beforeFullLocked + fullRewardsLocked);


      const stakerDataFinal = await contract.stakers(stakerA.address);

      // confirm all values are 0 after complete withdrawal
      expect(stakerDataFinal.amountStaked).to.eq(0n);
      expect(stakerDataFinal.amountStakedLocked).to.eq(0n);
      expect(stakerDataFinal.owedRewards).to.eq(0n);
      expect(stakerDataFinal.owedRewardsLocked).to.eq(0n);
      expect(stakerDataFinal.lastTimestamp).to.eq(0n);
      expect(stakerDataFinal.lastTimestampLocked).to.eq(0n);
      expect(stakerDataFinal.unlockedTimestamp).to.eq(0n);
    })
  })
});
