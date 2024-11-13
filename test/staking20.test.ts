import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  DeflERC20Mock,
  MockERC20,
  MockERC20__factory,
  StakingERC20,
  StakingERC20__factory,
} from "../typechain";
import {
  NO_REWARDS_ERR,
  TIME_LOCK_NOT_PASSED_ERR,
  INSUFFICIENT_ALLOWANCE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  UNEQUAL_UNSTAKE_ERR,
  OWNABLE_UNAUTHORIZED_ERR, ZERO_UNSTAKE_ERR,
} from "./helpers/errors";
import {
  WITHDRAW_EVENT,
  INIT_BALANCE,
  DEFAULT_STAKED_AMOUNT,
  calcTotalRewards,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  DEFAULT_REWARDS_PER_PERIOD,
  DEFAULT_PERIOD_LENGTH,
  DEFAULT_LOCK_TIME,
  DAY_IN_SECONDS,
} from "./helpers/staking";
import { ethers } from "ethers";
import {
  IZModulesConfig,
  IERC20DeployArgs,
  TestIERC20DeployArgs,
  contractNames,
  runZModulesCampaign,
} from "../src/deploy";
import { MongoDBAdapter } from "@zero-tech/zdc";
import { getStakingERC20Mission } from "../src/deploy/missions/stakingERC20.mission";
import { acquireLatestGitTag } from "../src/utils/git-tag/save-tag";
import { getMockERC20Mission, TokenTypes } from "../src/deploy/missions/mockERC20.mission";
import { getCampaignConfig } from "../src/deploy/campaign/environment";


describe("StakingERC20", () => {
  let deployer : SignerWithAddress;
  let owner : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
  let stakerD : SignerWithAddress;
  let stakerF : SignerWithAddress;
  let notStaker : SignerWithAddress;
  let edgeStaker : SignerWithAddress;

  let stakingContractERC20 : StakingERC20;

  let stakingToken : MockERC20;
  let rewardsToken : MockERC20;

  let config : TestIERC20DeployArgs;

  // The amount we increase the `block.timestamp` by whenever we mine manually
  const timeIncreaseAmount = 5n;

  // Track first stake and most recent stake times
  let origStakedAtA : bigint;
  let stakedAtA : bigint;
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

  let dbAdapter : MongoDBAdapter;

  before(async () => {
    [
      deployer,
      owner,
      stakerA,
      stakerB,
      stakerC,
      stakerD,
      stakerF,
      notStaker,
      edgeStaker,
    ] = await hre.ethers.getSigners();

    const argsForDeployERC20 : IERC20DeployArgs = {
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD,
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
      contractOwner: owner.address,
    };

    const campaignConfig = getCampaignConfig({
      deployAdmin: deployer,
      mockTokens: true,
      postDeploy: {
        tenderlyProjectSlug: "dummy-slug",
        monitorContracts: false,
        verifyContracts: false,
      },
      stk20Config: argsForDeployERC20,
    });

    // consts with names
    const stakingConsts = contractNames.stakingERC20;

    const campaign = await runZModulesCampaign({
      config: campaignConfig,
      missions: [
        getMockERC20Mission({ tokenType: TokenTypes.staking }),
        getMockERC20Mission({ tokenType: TokenTypes.rewards }),
        getStakingERC20Mission(stakingConsts.instance),
      ],
    });

    ({
      stakingERC20: stakingContractERC20,
      mock20STK: stakingToken,
      mock20REW: rewardsToken,
      dbAdapter,
    } = campaign);

    config = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ...campaignConfig.stakingERC20Config!,
      stakingToken: await stakingToken.getAddress(),
      rewardsToken: await rewardsToken.getAddress(),
    };

    const stakersArr = [
      owner,
      stakerA,
      stakerB,
      stakerC,
      stakerD,
      stakerF,
      edgeStaker,
    ];

    for (const staker of stakersArr) {
      await stakingToken.mint(staker.address, INIT_BALANCE);
      await stakingToken.connect(staker).approve(await stakingContractERC20.getAddress(), hre.ethers.MaxUint256);
    }

    await rewardsToken.mint(owner.address, INIT_BALANCE);

    // Always start at the same block going forward, disable auto mining for each tx
    await hre.network.provider.send("evm_setAutomine", [false]);
    await time.increaseTo(1800000000);
  });

  after(async () => {
    await dbAdapter.dropDB();
  });

  describe("#getContractRewardsBalance", () => {
    it("Allows a user to see the total rewards remaining in a pool", async () => {
      const rewardsInPool = await stakingContractERC20.getContractRewardsBalance();
      const poolBalance = await rewardsToken.balanceOf(await stakingContractERC20.getAddress());
      expect(rewardsInPool).to.eq(poolBalance);
    });
  });

  describe("#stake", () => {
    it.only("Numbers testing for devnet", async () => {
      //TEMP
      await hre.network.provider.send("evm_setAutomine", [true]);

      await stakingContractERC20.connect(stakerA).stake(DEFAULT_STAKED_AMOUNT);
      const localStakedAt = await time.latest();
      console.log("periodLength: ", await stakingContractERC20.periodLength())

      console.log(
        `pendingrewards @ ${await time.latest()} : ${await stakingContractERC20.connect(stakerA).getPendingRewards()}`
      );

      await time.increase(timeIncreaseAmount);

      console.log(
        `pendingrewards @ ${await time.latest()} : ${await stakingContractERC20.connect(stakerA).getPendingRewards()}`
      );

      await time.increase(timeIncreaseAmount * 17n);

      console.log(
        `pendingrewards @ ${await time.latest()} : ${await stakingContractERC20.connect(stakerA).getPendingRewards()}`
      );

      const quarter = 90n * DAY_IN_SECONDS;
      // increase 3 months
      await time.increase(quarter);

      await rewardsToken.connect(owner).mint(
        await stakingContractERC20.getAddress(),
        hre.ethers.parseEther("999999999")
      );

      // const stakerData = await stakingContractERC20.stakers(stakerA.address);
      // console.log("stakerData.amountStaked", stakerData.amountStaked.toString());
      // console.log("stakerData.owedRewards", stakerData.owedRewards.toString());

      // pendingRewards = await stakingContractERC20.connect(stakerA).getPendingRewards();
      // console.log("pendingRewards", pendingRewards.toString());

      // claim
      await stakingContractERC20.connect(stakerA).claim();

      console.log(await rewardsToken.balanceOf(stakerA.address));

      await hre.network.provider.send("evm_setAutomine", [false]);
    });
    it("Can stake an amount successfully", async () => {
      const stakeBalanceBeforeA = await stakingToken.balanceOf(stakerA.address);

      const totalStakedBefore = await stakingContractERC20.totalStaked();

      // Always mine block before expects
      // Always update timestamps after mining a block
      await stakingContractERC20.connect(stakerA).stake(DEFAULT_STAKED_AMOUNT);

      await time.increase(timeIncreaseAmount);
      stakedAtA = BigInt(await time.latest());
      origStakedAtA = stakedAtA;

      amountStakedA = DEFAULT_STAKED_AMOUNT;

      const totalStakedAfter = await stakingContractERC20.totalStaked();

      const stakeBalanceAfterA = await stakingToken.balanceOf(stakerA.address);

      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);

      const stakerData = await stakingContractERC20.stakers(stakerA.address);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtA + config.timeLockPeriod);
      expect(stakerData.owedRewards).to.eq(0n);

      expect(totalStakedAfter - totalStakedBefore).to.eq(DEFAULT_STAKED_AMOUNT);
    });

    it("Can stake a second time as the same user successfully", async () => {
      const stakeBalanceBeforeA = await stakingToken.balanceOf(stakerA.address);
      const rewardsBalanceBeforeA = await rewardsToken.balanceOf(stakerA.address);

      const totalStakedBefore = await stakingContractERC20.totalStaked();

      await stakingContractERC20.connect(stakerA).stake(DEFAULT_STAKED_AMOUNT);

      // Mine block for tx
      await time.increase(timeIncreaseAmount);
      stakedAtA = BigInt(await time.latest());
      amountStakedA += DEFAULT_STAKED_AMOUNT;

      const stakerData = await stakingContractERC20.stakers(stakerA.address);

      // Includes the `staker.owedRewards` calculated from second stake addition
      const pendingRewards = await stakingContractERC20.connect(stakerA).getPendingRewards();
      const totalStakedAfter = await stakingContractERC20.totalStaked();

      const expectedRewards = calcTotalRewards(
        [stakedAtA - origStakedAtA],
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      expect(pendingRewards).to.eq(expectedRewards);

      const stakeBalanceAfterA = await stakingToken.balanceOf(stakerA.address);
      const rewardsBalanceAfterA = await rewardsToken.balanceOf(stakerA.address);

      // They have gained pending rewards but are not yet given them
      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT * 2n);
      expect(stakerData.unlockTimestamp).to.eq(origStakedAtA + config.timeLockPeriod);

      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.owedRewards).to.eq(expectedRewards);

      expect(totalStakedAfter - totalStakedBefore).to.eq(DEFAULT_STAKED_AMOUNT);
    });

    it("Can stake as a new user when others are already staked", async () => {
      const stakeBalanceBefore = await stakingToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerB.address);

      await stakingContractERC20.connect(stakerB).stake(DEFAULT_STAKED_AMOUNT);
      // Mine block for tx
      await time.increase(timeIncreaseAmount);
      stakedAtB = BigInt(await time.latest());
      origStakedAtB = stakedAtB;

      const pendingRewards = await stakingContractERC20.connect(stakerB).getPendingRewards();

      const expectedRewards = calcTotalRewards(
        [stakedAtB - origStakedAtB], // will be the same values
        [DEFAULT_STAKED_AMOUNT],
        config.rewardsPerPeriod,
        config.periodLength
      );

      const stakeBalanceAfter = await stakingToken.balanceOf(stakerB.address);
      const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerB.address);

      const stakerData = await stakingContractERC20.stakers(stakerB.address);

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
        stakingContractERC20.connect(notStaker).stake(DEFAULT_STAKED_AMOUNT)
      ).to.be.revertedWithCustomError(rewardsToken, INSUFFICIENT_ALLOWANCE_ERR)
        .withArgs(stakingContractERC20.target, 0n, DEFAULT_STAKED_AMOUNT);

      it("Fails when the staker tries to stake 0", async () => {
        // Then after we allow funds, it will fail on balance
        await stakingToken.connect(notStaker).approve(await stakingContractERC20.getAddress(), DEFAULT_STAKED_AMOUNT);

        const balance = await stakingToken.balanceOf(notStaker.address);
        await expect(
          stakingContractERC20.connect(notStaker).stake(DEFAULT_STAKED_AMOUNT)
        ).to.be.revertedWithCustomError(stakingToken, INSUFFICIENT_BALANCE_ERR)
          .withArgs(notStaker.address, balance, DEFAULT_STAKED_AMOUNT);

        await hre.network.provider.send("evm_setAutomine", [false]);
      });
    });

    describe("#getRemainingLockTime", () => {
      it("Allows the user to view the remaining time lock period for a stake", async () => {
        const remainingLockTime = await stakingContractERC20.connect(stakerA).getRemainingLockTime();
        const latest = await time.latest();

        const stakeData = await stakingContractERC20.stakers(stakerA.address);

        // Original lock period and remaining lock period time difference should be the same as
        // the difference between the latest timestamp and that token's stake timestamp
        expect(remainingLockTime).to.eq((stakeData.unlockTimestamp - BigInt(latest)));
      });

      it("Returns 0 for a user that's passed their lock time", async () => {
        await time.increase(config.timeLockPeriod);

        const remainingLockTime = await stakingContractERC20.connect(stakerA).getRemainingLockTime();
        expect(remainingLockTime).to.eq(0n);
      });

      it("Returns 0 for a user that has not staked", async () => {
        const remainingLockTime = await stakingContractERC20.connect(notStaker).getRemainingLockTime();
        expect(remainingLockTime).to.eq(0n);
      });
    });

    describe("#getPendingRewards", () => {
      it("Allows the user to view the pending rewards for a stake", async () => {
        const pendingRewards = await stakingContractERC20.connect(stakerA).getPendingRewards();

        const expectedRewards = calcTotalRewards(
          [BigInt(await time.latest()) - stakedAtA, stakedAtA - origStakedAtA],
          [amountStakedA, DEFAULT_STAKED_AMOUNT],
          config.rewardsPerPeriod,
          config.periodLength
        );

        // It will always provide the correct value for the rewards owed to
        // the user, even when the contract does not have the balance for it
        const contractBalance = await rewardsToken.balanceOf(await stakingContractERC20.getAddress());

        expect(contractBalance).to.eq(0n);
        expect(pendingRewards).to.eq(expectedRewards);
      });

      it("Returns 0 for a user that has not staked", async () => {
        const pendingRewards = await stakingContractERC20.connect(notStaker).getPendingRewards();
        expect(pendingRewards).to.eq(0n);
      });

      it("Returns 0 for a user that has staked but not passed a time period", async () => {
        await hre.network.provider.send("evm_setAutomine", [false]);

        await stakingContractERC20.connect(stakerD).stake(DEFAULT_STAKED_AMOUNT);

        await time.increase(timeIncreaseAmount);
        stakedAtD = BigInt(await time.latest());
        origStakedAtD = stakedAtD;

        const stakerData = await stakingContractERC20.stakers(stakerD.address);

        const pendingRewards = await stakingContractERC20.connect(stakerD).getPendingRewards();

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

        // Give staking contract balance to pay rewards
        await rewardsToken.connect(owner).transfer(
          await stakingContractERC20.getAddress(),
          expectedRewards
        );
        await time.increase(timeIncreaseAmount);

        const totalStakedBefore = await stakingContractERC20.totalStaked();
        const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);

        const stakerDataBefore = await stakingContractERC20.stakers(stakerA.address);

        await stakingContractERC20.connect(stakerA).claim();
        await time.increase(timeIncreaseAmount);
        claimedAtA = BigInt(await time.latest());

        const totalStakedAfter = await stakingContractERC20.totalStaked();

        const stakerData = await stakingContractERC20.stakers(stakerA.address);

        const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);

        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + expectedRewards);
        expect(stakerData.owedRewards).to.eq(0n);

        expect(totalStakedAfter).to.eq(totalStakedBefore);
      });

      it("Fails when the user has never staked", async () => {
        // `onlyUnlocked` is the first thing checked in this flow
        // and fails when the user has no set unlock timestamp
        await hre.network.provider.send("evm_setAutomine", [true]);

        await expect(
          stakingContractERC20.connect(notStaker).claim()
        ).to.be.revertedWithCustomError(stakingContractERC20, TIME_LOCK_NOT_PASSED_ERR);
      });

      it("Fails when the contract has no rewards", async () => {
        // call to claim without first transferring rewards to the contract
        await expect(
          // we are using `stakerB` here, because the check would only hit if the
          // user who calls actually has rewards to claim
          // otherwise, if user has 0 rewards, the check for rewards availability will not hit
          stakingContractERC20.connect(stakerB).claim()
        ).to.be.revertedWithCustomError(stakingContractERC20, NO_REWARDS_ERR);
      });

      it("Fails when the user has not passed their lock time", async () => {
        await stakingContractERC20.connect(stakerC).stake(DEFAULT_STAKED_AMOUNT);

        await expect(
          stakingContractERC20.connect(stakerC).claim()
        ).to.be.revertedWithCustomError(stakingContractERC20, TIME_LOCK_NOT_PASSED_ERR);

        // Reset
        await stakingContractERC20.connect(stakerC).unstake(DEFAULT_STAKED_AMOUNT, true);

        await hre.network.provider.send("evm_setAutomine", [false]);
      });
    });

    describe("#unstake", () => {
      it("Allows a user to unstake partially and updates `totalStaked`", async () => {
        await time.increase(config.periodLength * 7n);

        // Unstake half of the original stake
        const amount = amountStakedA / 2n;
        const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerA.address);
        const stakeTokenBalanceBefore = await stakingToken.balanceOf(stakerA.address);

        // Calculate the rewards we expect after the next 3 transactions have occurred.
        const expectedRewards = calcTotalRewards(
          [BigInt(await time.latest()) + timeIncreaseAmount * 2n - claimedAtA],
          [amountStakedA],
          config.rewardsPerPeriod,
          config.periodLength
        );

        // Give staking contract balance to pay rewards
        await rewardsToken.connect(owner).transfer(
          await stakingContractERC20.getAddress(),
          expectedRewards
        );
        await time.increase(timeIncreaseAmount);

        const totalStakedBefore = await stakingContractERC20.totalStaked();

        await stakingContractERC20.connect(stakerA).unstake(amount, false);
        await time.increase(timeIncreaseAmount);
        unstakedAtA = BigInt(await time.latest());

        const totalStakedAfter = await stakingContractERC20.totalStaked();

        const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
        const stakeTokenBalanceAfter = await stakingToken.balanceOf(stakerA.address);

        expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + amount);
        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + expectedRewards);

        const stakerData = await stakingContractERC20.stakers(stakerA.address);
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
        const stakeTokenBalanceBefore = await stakingToken.balanceOf(stakerA.address);

        const expectedRewards = calcTotalRewards(
          [BigInt(await time.latest()) + timeIncreaseAmount * 2n - unstakedAtA],
          [amountStakedA],
          config.rewardsPerPeriod,
          config.periodLength
        );

        // Give staking contract balance to pay rewards
        await rewardsToken.connect(owner).transfer(
          await stakingContractERC20.getAddress(),
          expectedRewards
        );
        await time.increase(timeIncreaseAmount);

        await stakingContractERC20.connect(stakerA).unstake(amountStakedA, false);
        await time.increase(timeIncreaseAmount);
        unstakedAtA = BigInt(await time.latest());

        const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerA.address);
        const stakeTokenBalanceAfter = await stakingToken.balanceOf(stakerA.address);

        expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + amountStakedA);
        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + expectedRewards);

        const stakerData = await stakingContractERC20.stakers(stakerA.address);

        // Verify all values are reset to 0 after full withdrawal
        expect(stakerData.amountStaked).to.eq(0n);
        expect(stakerData.lastUpdatedTimestamp).to.eq(0n);
        expect(stakerData.unlockTimestamp).to.eq(0n);
        expect(stakerData.owedRewards).to.eq(0n);
      });

      it("Fails when unstaking 0 amount", async () => {
        await hre.network.provider.send("evm_setAutomine", [true]);

        await expect(
          stakingContractERC20.connect(stakerA).unstake(0, false)
        ).to.be.revertedWithCustomError(stakingContractERC20, ZERO_UNSTAKE_ERR);
      });

      it("Fails when the user has never staked", async () => {
        await expect(
          stakingContractERC20.connect(notStaker).unstake(DEFAULT_STAKED_AMOUNT, false)
        ).to.be.revertedWithCustomError(stakingContractERC20, UNEQUAL_UNSTAKE_ERR);
      });

      it("Fails when the user has not passed their lock time", async () => {
        await stakingContractERC20.connect(stakerC).stake(DEFAULT_STAKED_AMOUNT);
        origStakedAtC = BigInt(await time.latest());
        stakedAtC = origStakedAtC;

        const pendingRewards = await stakingContractERC20.connect(stakerC).getPendingRewards();

        // Restaking for the first time, do not add to old value
        amountStakedC = DEFAULT_STAKED_AMOUNT;

        const stakerData = await stakingContractERC20.stakers(stakerC.address);

        expect(stakerData.unlockTimestamp).to.eq(origStakedAtC + config.timeLockPeriod);
        expect(stakerData.amountStaked).to.eq(amountStakedC);
        expect(stakerData.owedRewards).to.eq(pendingRewards);
        expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtC);

        // Fail to unstake with rewards when not passed time lock period
        await expect(
          stakingContractERC20.connect(stakerC).unstake(DEFAULT_STAKED_AMOUNT, false)
        ).to.be.revertedWithCustomError(stakingContractERC20, TIME_LOCK_NOT_PASSED_ERR);
      });

      it("Fails when the user tries to unstake more than they have staked", async () => {
        await time.increase(config.timeLockPeriod);

        await expect(
          stakingContractERC20.connect(stakerC).unstake(amountStakedC + 1n, false)
        ).to.be.revertedWithCustomError(stakingContractERC20, UNEQUAL_UNSTAKE_ERR);

        await hre.network.provider.send("evm_setAutomine", [false]);
      });
    });

    describe("#unstake with 'exit'", () => {
      it("Allows a user to partially unstake without rewards using 'exit' and updates `totalStaked`", async () => {
        await time.increase(config.periodLength * 2n);

        const totalStakedBefore = await stakingContractERC20.totalStaked();
        const stakeBalanceBefore = await stakingToken.balanceOf(stakerC.address);
        const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

        // +2 to account for the prior two failures each incrementing +1
        const expectedRewards = calcTotalRewards(
          [BigInt(await time.latest()) + timeIncreaseAmount + 2n - origStakedAtC],
          [DEFAULT_STAKED_AMOUNT],
          config.rewardsPerPeriod,
          config.periodLength
        );

        // Allows unstaking with 'exit' before the time lock is over
        const amount = DEFAULT_STAKED_AMOUNT / 2n;
        await stakingContractERC20.connect(stakerC).unstake(amount, true);
        await time.increase(timeIncreaseAmount);

        unstakedAtC = BigInt(await time.latest());
        amountStakedC -= amount;

        const totalStakedAfter = await stakingContractERC20.totalStaked();
        const stakeBalanceAfter = await stakingToken.balanceOf(stakerC.address);
        const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerC.address);

        // Confirm they have pending rewards but don't receive them
        expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);
        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);

        const stakerData = await stakingContractERC20.stakers(stakerC.address);

        expect(stakerData.amountStaked).to.eq(amount);
        expect(stakerData.lastUpdatedTimestamp).to.eq(unstakedAtC);
        expect(stakerData.unlockTimestamp).to.eq(origStakedAtC + config.timeLockPeriod);
        expect(stakerData.owedRewards).to.eq(expectedRewards);
        expect(totalStakedBefore - totalStakedAfter).to.eq(amount);
      });

      it("Allows a user to fully unstake without rewards using 'exit' and claim later", async () => {
        await time.increase(config.periodLength * 3n);

        const stakeBalanceBefore = await stakingToken.balanceOf(stakerC.address);
        const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerC.address);

        const amount = DEFAULT_STAKED_AMOUNT / 2n;
        await stakingContractERC20.connect(stakerC).unstake(amount, true);
        await time.increase(timeIncreaseAmount);

        const exitTime = BigInt(await time.latest());

        const pendingRewards = await stakingContractERC20.connect(stakerC).getPendingRewards();

        const stakeBalanceAfter = await stakingToken.balanceOf(stakerC.address);
        const rewardsBalanceAfterUnstake = await rewardsToken.balanceOf(stakerC.address);

        // Confirm they have pending rewards but don't receive them
        expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + amount);
        expect(rewardsBalanceAfterUnstake).to.eq(rewardsBalanceBefore);

        const stakerData = await stakingContractERC20.stakers(stakerC.address);

        // Fails, why does this not delete the struct properly?
        expect(stakerData.amountStaked).to.eq(0n);
        expect(stakerData.lastUpdatedTimestamp).to.eq(exitTime);
        expect(stakerData.unlockTimestamp).to.eq(stakedAtC + config.timeLockPeriod);
        expect(stakerData.owedRewards).to.eq(pendingRewards);

        unstakedAtC = BigInt(await time.latest());
        amountStakedC -= amount;

        // Give staking contract balance to pay rewards
        await rewardsToken.connect(owner).transfer(
          await stakingContractERC20.getAddress(),
          pendingRewards
        );
        await time.increase(timeIncreaseAmount);

        // claim all rewards to delete struct
        await stakingContractERC20.connect(stakerC).claim();
        await time.increase(timeIncreaseAmount);

        // Confirm we got all the balances we're owed
        const rewardsBalanceAfterClaim = await rewardsToken.balanceOf(stakerC.address);
        expect(rewardsBalanceAfterClaim).to.eq(stakerData.owedRewards);

        // validate struct has been deleted
        const stakerDataAfterClaim = await stakingContractERC20.stakers(stakerC.address);
        expect(stakerDataAfterClaim.amountStaked).to.eq(0n);
        expect(stakerDataAfterClaim.lastUpdatedTimestamp).to.eq(0n);
        expect(stakerDataAfterClaim.unlockTimestamp).to.eq(0n);
        expect(stakerDataAfterClaim.owedRewards).to.eq(0n);
      });

      it("Fails when the user has never staked", async () => {
        await hre.network.provider.send("evm_setAutomine", [true]);

        await expect(
          stakingContractERC20.connect(notStaker).unstake(1, true)
        ).to.be.revertedWithCustomError(stakingContractERC20, UNEQUAL_UNSTAKE_ERR);

        await hre.network.provider.send("evm_setAutomine", [false]);
      });

      it("Unstakes with `exit` when the user has not passed their lock time", async () => {
        await stakingContractERC20.connect(stakerC).stake(DEFAULT_STAKED_AMOUNT);
        await time.increase(timeIncreaseAmount);
        stakedAtC = BigInt(await time.latest());

        // Fully withdrew stake previously, so expect a new unlock time
        origStakedAtC = stakedAtC;
        amountStakedC = DEFAULT_STAKED_AMOUNT;


        // unstake without rewards when not passed time lock period
        await stakingContractERC20.connect(stakerC).unstake(DEFAULT_STAKED_AMOUNT, true);
        await time.increase(timeIncreaseAmount);
        const exitTime = BigInt(await time.latest());

        const pendingRewards = await stakingContractERC20.connect(stakerC).getPendingRewards();

        const stakerData = await stakingContractERC20.stakers(stakerC.address);

        expect(stakerData.amountStaked).to.eq(0n);
        expect(stakerData.unlockTimestamp).to.eq(origStakedAtC + config.timeLockPeriod);
        expect(stakerData.owedRewards).to.eq(pendingRewards);
        expect(stakerData.lastUpdatedTimestamp).to.eq(exitTime);
      });

      it("Fails when the user tries to unstake more than they have staked", async () => {
        await hre.network.provider.send("evm_setAutomine", [true]);

        await expect(
          stakingContractERC20.connect(stakerC).unstake(amountStakedC + 1n, true)
        ).to.be.revertedWithCustomError(stakingContractERC20, UNEQUAL_UNSTAKE_ERR);

        await hre.network.provider.send("evm_setAutomine", [false]);
      });
    });

    describe("#withdrawLeftoverRewards", () => {
      it("Allows the admin to withdraw leftover rewards", async () => {
        const amount = 1000n;
        await rewardsToken.connect(owner).transfer(
          await stakingContractERC20.getAddress(),
          amount
        );
        await time.increase(timeIncreaseAmount);

        const rewardsBalanceBefore = await rewardsToken.balanceOf(owner.address);
        const contractRewardsBalanceBefore = await stakingContractERC20.getContractRewardsBalance();

        await stakingContractERC20.connect(owner).withdrawLeftoverRewards();
        await time.increase(timeIncreaseAmount);

        const rewardsBalanceAfter = await rewardsToken.balanceOf(owner.address);
        const contractRewardsBalanceAfter = await stakingContractERC20.getContractRewardsBalance();

        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + amount);
        expect(contractRewardsBalanceAfter).to.eq(contractRewardsBalanceBefore - amount);
        expect(contractRewardsBalanceAfter).to.eq(0n);
      });

      it("Fails when the caller is not the admin", async () => {
        await hre.network.provider.send("evm_setAutomine", [true]);

        await expect(
          stakingContractERC20.connect(notStaker).withdrawLeftoverRewards()
        ).to.be.revertedWithCustomError(stakingContractERC20, OWNABLE_UNAUTHORIZED_ERR)
          .withArgs(notStaker.address);
      });

      it("Fails when the contract has no rewards left to withdraw", async () => {
        await expect(
          stakingContractERC20.connect(owner).withdrawLeftoverRewards()
        ).to.be.revertedWithCustomError(stakingContractERC20, NO_REWARDS_ERR);

        await hre.network.provider.send("evm_setAutomine", [false]);
      });
    });

    describe("Events", () => {
      it("Emits a Staked event when a user stakes", async () => {
        await hre.network.provider.send("evm_setAutomine", [true]);

        await expect(
          stakingContractERC20.connect(stakerF).stake(DEFAULT_STAKED_AMOUNT)
        ).to.emit(stakingContractERC20, STAKED_EVENT)
          .withArgs(stakerF.address, DEFAULT_STAKED_AMOUNT, DEFAULT_STAKED_AMOUNT, config.stakingToken);

        stakedAtF = BigInt(await time.latest());

        await hre.network.provider.send("evm_setAutomine", [false]);
      });

      it("Emits a Claimed event when a user claims rewards", async () => {
        await time.increase(config.timeLockPeriod);

        // Calculate for future transactions. +5 for manual time increase in transfer,
        // and an extra + 1 for auto time increase when calling `claim`
        const expectedRewards = calcTotalRewards(
          [BigInt(await time.latest()) + timeIncreaseAmount + 1n - stakedAtF],
          [DEFAULT_STAKED_AMOUNT],
          config.rewardsPerPeriod,
          config.periodLength
        );

        await rewardsToken.connect(owner).transfer(
          await stakingContractERC20.getAddress(),
          expectedRewards
        );
        await time.increase(timeIncreaseAmount);

        await hre.network.provider.send("evm_setAutomine", [true]);

        await expect(
          stakingContractERC20.connect(stakerF).claim()
        ).to.emit(stakingContractERC20, CLAIMED_EVENT)
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
          await stakingContractERC20.getAddress(),
          expectedRewards
        );
        await time.increase(timeIncreaseAmount);

        const stakerData = await stakingContractERC20.stakers(stakerF.address);

        await hre.network.provider.send("evm_setAutomine", [true]);

        await expect(
          stakingContractERC20.connect(stakerF).unstake(stakerData.amountStaked / 2n, false)
        ).to.emit(stakingContractERC20, UNSTAKED_EVENT)
          .withArgs(stakerF.address, stakerData.amountStaked / 2n, config.stakingToken);

        await hre.network.provider.send("evm_setAutomine", [false]);
      });

      it("Emits an Unstaked event when a user exits with unstake", async () => {
        await time.increase(config.periodLength * 7n);

        const stakerData = await stakingContractERC20.stakers(stakerF.address);

        const rewardsBalanceBefore = await rewardsToken.balanceOf(stakerF.address);
        const stakeBalanceBefore = await stakingToken.balanceOf(stakerF.address);

        await hre.network.provider.send("evm_setAutomine", [true]);

        await expect(
          stakingContractERC20.connect(stakerF).unstake(stakerData.amountStaked, true)
        ).to.emit(stakingContractERC20, UNSTAKED_EVENT)
          .withArgs(stakerF.address, stakerData.amountStaked, config.stakingToken);

        const rewardsBalanceAfter = await rewardsToken.balanceOf(stakerF.address);
        const stakeBalanceAfter = await stakingToken.balanceOf(stakerF.address);

        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
        expect(stakeBalanceAfter).to.eq(stakeBalanceBefore + stakerData.amountStaked);

        const pendingRewards = await stakingContractERC20.connect(stakerF).getPendingRewards();
        // fund the contract
        await rewardsToken.connect(owner).transfer(
          await stakingContractERC20.getAddress(),
          pendingRewards
        );

        // claim to clear the struct
        await stakingContractERC20.connect(stakerF).claim();

        const stakerDataAfter = await stakingContractERC20.stakers(stakerF.address);

        // make sure the struct is cleared
        expect(stakerDataAfter.amountStaked).to.eq(0n);
        expect(stakerDataAfter.lastUpdatedTimestamp).to.eq(0n);
        expect(stakerDataAfter.unlockTimestamp).to.eq(0n);
        expect(stakerDataAfter.owedRewards).to.eq(0n);
      });

      it("Emits 'LeftoverRewardsWithdrawn' event when the admin withdraws", async () => {
        const balance = await rewardsToken.balanceOf(await stakingContractERC20.getAddress());

        let amount = balance;
        if (balance === 0n) {
          amount = 1231231n;
          await rewardsToken.connect(owner).transfer(
            await stakingContractERC20.getAddress(),
            amount
          );
        }

        await expect(
          stakingContractERC20.connect(owner).withdrawLeftoverRewards()
        ).to.emit(stakingContractERC20, WITHDRAW_EVENT)
          .withArgs(owner.address, amount);

        // turn off automine?
      });
    });

    describe("Special Cases", async () => {
      describe("Exiting", () => {
        // eslint-disable-next-line max-len
        it("#exit from staking should yield the same rewards for partial and full exit within `unlockTimestamp` rules", async () => {
          await hre.network.provider.send("evm_setAutomine", [true]);

          await rewardsToken.connect(owner).transfer(
            stakingContractERC20.target,
            1000000n
          );
          await time.increase(timeIncreaseAmount);

          const stakeAmt = 100n;

          await stakingContractERC20.connect(edgeStaker).stake(stakeAmt);
          const stakeTime = BigInt(await time.latest());

          // partially exit before timelock passed
          const halfStakeAmt = stakeAmt / 2n;
          await stakingContractERC20.connect(edgeStaker).unstake(halfStakeAmt, true);
          const unstakeTime = BigInt(await time.latest());

          // No rewards were transferred, should be zero
          const balAfterExit = await rewardsToken.balanceOf(edgeStaker.address);

          const timeToRewards = config.timeLockPeriod + config.periodLength * 2n;
          await time.increase(timeToRewards);

          await stakingContractERC20.connect(edgeStaker).claim();

          const firstClaimTime = BigInt(await time.latest());
          const balAfterFirstClaim = await rewardsToken.balanceOf(edgeStaker.address);

          const rewardsForHalfStake = calcTotalRewards(
            [firstClaimTime - unstakeTime, unstakeTime - stakeTime],
            [halfStakeAmt, stakeAmt],
            config.rewardsPerPeriod,
            config.periodLength
          );

          // should get rewards for the half-stake since he exited before rewards started generating
          expect(balAfterFirstClaim - balAfterExit).to.eq(rewardsForHalfStake);

          const {
            owedRewards: owedRewardsAfterTimelock,
            amountStaked,
          } = await stakingContractERC20.stakers(edgeStaker.address);
          // zero rewards cause he just got them all
          expect(owedRewardsAfterTimelock).to.eq(0n);
          expect(amountStaked).to.eq(halfStakeAmt);

          // increase time to generate rewards for the new period
          await time.increase(timeToRewards);

          // fully exit
          await stakingContractERC20.connect(edgeStaker).unstake(halfStakeAmt, true);
          const remainderUnstakeTime = BigInt(await time.latest());

          const rewardsForHalfStakeUpdate = calcTotalRewards(
            [remainderUnstakeTime - firstClaimTime],
            [halfStakeAmt],
            config.rewardsPerPeriod,
            config.periodLength
          );

          const {
            owedRewards: owedRewardsAfterExit,
            amountStaked: stakedAfterExit,
          } = await stakingContractERC20.stakers(edgeStaker.address);
          expect(owedRewardsAfterExit).to.eq(rewardsForHalfStakeUpdate);
          expect(stakedAfterExit).to.eq(0n);

          // even though he exited, rewards have been generated, so he should be able to claim them
          // even though he doesn't have stake in anymore
          await stakingContractERC20.connect(edgeStaker).claim();

          // now make sure staker struct got deleted
          const stakerDataFinal = await stakingContractERC20.stakers(edgeStaker.address);
          expect(stakerDataFinal.amountStaked).to.eq(0n);
          expect(stakerDataFinal.lastUpdatedTimestamp).to.eq(0n);
          expect(stakerDataFinal.unlockTimestamp).to.eq(0n);
          expect(stakerDataFinal.owedRewards).to.eq(0n);

          const balAfterClaim = await rewardsToken.balanceOf(edgeStaker.address);
          expect(balAfterClaim - balAfterFirstClaim).to.eq(rewardsForHalfStakeUpdate);
        });

        it("should let the user who exits fully after timelock to claim all his available rewards", async () => {
          await rewardsToken.connect(owner).transfer(
            stakingContractERC20.target,
            1000000n
          );

          const stakeAmt = 100n;

          await stakingContractERC20.connect(edgeStaker).stake(stakeAmt);
          const stakeTime = BigInt(await time.latest());

          await time.increase(config.timeLockPeriod + config.periodLength * 2n);

          // fully unstake
          await stakingContractERC20.connect(edgeStaker).unstake(stakeAmt, true);
          const unstakeTime = BigInt(await time.latest());

          const rewardsForFullStake = calcTotalRewards(
            [unstakeTime - stakeTime],
            [stakeAmt],
            config.rewardsPerPeriod,
            config.periodLength
          );

          const {
            owedRewards: owedRewardsInitial,
          } = await stakingContractERC20.stakers(edgeStaker.address);

          expect(owedRewardsInitial).to.eq(rewardsForFullStake);

          const balAfterExit = await rewardsToken.balanceOf(edgeStaker.address);

          await stakingContractERC20.connect(edgeStaker).claim();

          const {
            owedRewards: owedRewardsAfterClaim,
            amountStaked: amountStakedAfterClaim,
            unlockTimestamp,
            lastUpdatedTimestamp,
          } = await stakingContractERC20.stakers(edgeStaker.address);

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
          const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");
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

          // +1 to account for transfer function below moving time forward 1s
          const pendingRewardsRef = calcTotalRewards(
            [timeToRewards + 1n],
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
        let stakeToken : DeflERC20Mock;
        let staking : StakingERC20;
        let transferAmtStk : bigint;
        let tokenBalAfterStk : bigint;
        let totalStakedAfterStk : bigint;
        let contractBalAfterStk : bigint;

        const stakeAmt = ethers.parseEther("291");

        it("Should correctly account staked amount on #stake()", async () => {
          const stakingTokenFactory = await hre.ethers.getContractFactory("DeflERC20Mock");
          stakeToken = await stakingTokenFactory.connect(owner).deploy("Deflationary Token", "DTK");
          const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");
          staking = await stakingFactory.deploy(
            stakeToken.target,
            config.rewardsToken,
            config.rewardsPerPeriod,
            config.periodLength,
            config.timeLockPeriod,
            owner.address
          ) as StakingERC20;

          const transferFeeStk = await stakeToken.getFee(stakeAmt);

          await stakeToken.connect(owner).transfer(
            edgeStaker.address,
            hre.ethers.parseEther("1000")
          );

          await stakeToken.connect(edgeStaker).approve(
            staking.target,
            stakeAmt
          );

          const tokenBalBefore = await stakeToken.balanceOf(edgeStaker.address);
          const totalStakedBefore = await staking.totalStaked();
          const contractBalBefore = await stakeToken.balanceOf(staking.target);

          transferAmtStk = stakeAmt - transferFeeStk;

          // stake and check event in one go
          await expect(
            staking.connect(edgeStaker).stake(stakeAmt)
          ).to.emit(staking, STAKED_EVENT)
            .withArgs(edgeStaker.address, stakeAmt, transferAmtStk, stakeToken.target);

          tokenBalAfterStk = await stakeToken.balanceOf(edgeStaker.address);
          totalStakedAfterStk = await staking.totalStaked();
          contractBalAfterStk = await stakeToken.balanceOf(staking.target);

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

          const transferFeeExit = await stakeToken.getFee(transferAmtStk);
          const transferAmtExit = transferAmtStk - transferFeeExit;

          const tokenBalAfterExit = await stakeToken.balanceOf(edgeStaker.address);
          const totalStakedAfterExit = await staking.totalStaked();
          const contractBalAfterExit = await stakeToken.balanceOf(staking.target);

          expect(tokenBalAfterExit - tokenBalAfterStk).to.eq(transferAmtExit);
          expect(totalStakedAfterStk - totalStakedAfterExit).to.eq(transferAmtStk);
          expect(totalStakedAfterExit).to.eq(0n);
          expect(contractBalAfterStk - contractBalAfterExit).to.eq(transferAmtStk);
        });
      });
    });

    describe("Deploy", () => {
      it("Deployed contract should exist in the DB", async () => {
        const nameOfContract = contractNames.stakingERC20.contract;
        const addressOfContract = await stakingContractERC20.getAddress();
        const contractFromDB = await dbAdapter.getContract(nameOfContract);
        const stakingArtifact = await hre.artifacts.readArtifact(contractNames.stakingERC20.contract);

        expect({
          addrs: contractFromDB?.address,
          label: contractFromDB?.name,
          abi: JSON.stringify(stakingArtifact.abi),
        }).to.deep.equal({
          addrs: addressOfContract,
          label: nameOfContract,
          abi: contractFromDB?.abi,
        });
      });

      it("Should be deployed with correct args", async () => {
        const expectedArgs = {
          rewardsToken: await stakingContractERC20.rewardsToken(),
          stakingToken: await stakingContractERC20.stakingToken(),
          rewardsPerPeriod: await stakingContractERC20.rewardsPerPeriod(),
          periodLength: await stakingContractERC20.periodLength(),
          timeLockPeriod: await stakingContractERC20.timeLockPeriod(),
        };

        expect(expectedArgs.rewardsToken).to.eq(config.rewardsToken);
        expect(expectedArgs.stakingToken).to.eq(config.stakingToken);
        expect(expectedArgs.rewardsPerPeriod).to.eq(config.rewardsPerPeriod);
        expect(expectedArgs.periodLength).to.eq(config.periodLength);
        expect(expectedArgs.timeLockPeriod).to.eq(config.timeLockPeriod);
      });

      it("Should have correct db and contract versions", async () => {
        const tag = await acquireLatestGitTag();
        const contractFromDB = await dbAdapter.getContract(contractNames.stakingERC20.contract);
        const dbDeployedV = await dbAdapter.versioner.getDeployedVersion();

        expect({
          dbVersion: contractFromDB?.version,
          contractVersion: dbDeployedV?.contractsVersion,
        }).to.deep.equal({
          dbVersion: dbDeployedV?.dbVersion,
          contractVersion: tag,
        });
      });

      it("Should transfer ownership to the address passed as owner in the config during deploy", async () => {
        const contractOwner = await stakingContractERC20.owner();

        expect(contractOwner).to.eq(owner);
      });
    });

    describe("Separate tokens", () => {
      let staking20 : StakingERC20;
      let stakingMock : MockERC20;
      let rewardMock : MockERC20;

      before(async () => {
        const stakingMockFactory = await hre.ethers.getContractFactory("MockERC20");
        stakingMock = await stakingMockFactory.deploy("Meow", "MEOW");
        rewardMock = await stakingMockFactory.deploy("Meow2", "MEOW2");

        [
          deployer,
          owner,
        ] = await hre.ethers.getSigners();

        const argsForDeploy20 = {
          stakingToken: await stakingMock.getAddress(),
          rewardsToken: await rewardMock.getAddress(),
          rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD,
          periodLength: DEFAULT_PERIOD_LENGTH,
          timeLockPeriod: DEFAULT_LOCK_TIME,
          contractOwner: owner.address,
        };

        const campaignConfig : IZModulesConfig = getCampaignConfig({
          mockTokens: false,
          deployAdmin: owner,
          postDeploy: {
            tenderlyProjectSlug: "string",
            monitorContracts: false,
            verifyContracts: false,
          },
          stk20Config: argsForDeploy20,
        });

        const stakingConsts = contractNames.stakingERC20;
        const campaign = await runZModulesCampaign({
          config: campaignConfig,
          missions: [
            getStakingERC20Mission(stakingConsts.instance),
          ],
        });

        staking20 = campaign.state.contracts.stakingERC20;
      });

      after(async () => {
        await dbAdapter.dropDB();
      });

      it("Should deploy contract with mock, provided separetely from campaign", async () => {
        expect(await staking20.stakingToken()).to.eq(await stakingMock.getAddress());
        expect(await staking20.rewardsToken()).to.eq(await rewardMock.getAddress());
      });
    });
  });
});