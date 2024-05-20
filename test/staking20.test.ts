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
  NO_REWARDS_ERR,
  TIME_LOCK_NOT_PASSED_ERR,
  BaseConfig,
  INSUFFICIENT_ALLOWANCE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  ZERO_STAKE_ERR,
  UNEQUAL_UNSTAKE_ERR,
  ONLY_OWNER_ERR,
  WITHDRAW_EVENT,
  INIT_BALANCE,
  DEFAULT_STAKED_AMOUNT,
} from "./helpers/staking";
import { DCConfig, IERC20DeployArgs, runCampaign } from "../src/deploy";
import { MongoDBAdapter } from "@zero-tech/zdc";
import { ZModulesStakingERC20DM } from "../src/deploy/missions/stakingERC20.mission";

describe("StakingERC20", () => {
  let deployer : SignerWithAddress;
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
  let stakedAtA : bigint;

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
    ] = await hre.ethers.getSigners();

    const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    stakeToken = await mockERC20Factory.deploy("MEOW", "MEOW");

    rewardsToken = await mockERC20Factory.connect(owner).deploy("WilderWorld", "WW");

    config = await createDefaultConfigs(rewardsToken, undefined, stakeToken);

    const argsForDeployERC20 : IERC20DeployArgs = config;
    const argsForDeployERC721 = {
      stakingToken : "0x00000002",
      name : "Empty",
      symbol : "E",
      baseUri : "EmptyUri",
      rewardsToken : "0x00000001",
      rewardsPerPeriod : 0n,
      periodLength : 0n,
      timeLockPeriod : 0,
    };

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
        ZModulesStakingERC20DM,
      ],
    });

    dbAdapter = campaign.dbAdapter;

    const { stakingERC20 } = campaign;

    contract = stakingERC20;

    const stakersArr = [
      owner,
      stakerA,
      stakerB,
      stakerC,
      stakerD,
      stakerF,
    ];

    for (const staker of stakersArr) {
      await stakeToken.mint(staker.address, INIT_BALANCE);
      await stakeToken.connect(staker).approve(await contract.getAddress(), hre.ethers.MaxUint256);
    }
  });

  after(async () => {
    await dbAdapter.dropDB();
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
      stakedAtA = BigInt(await time.latest());
      origStakedAtA = stakedAtA;

      amountStakedA = DEFAULT_STAKED_AMOUNT;

      const stakeBalanceAfterA = await stakeToken.balanceOf(stakerA.address);

      const stakerData = await contract.stakers(stakerA.address);

      expect(stakeBalanceAfterA).to.eq(stakeBalanceBeforeA - DEFAULT_STAKED_AMOUNT);

      expect(stakerData.amountStaked).to.eq(DEFAULT_STAKED_AMOUNT);
      expect(stakerData.lastUpdatedTimestamp).to.eq(stakedAtA);
      expect(stakerData.unlockTimestamp).to.eq(stakedAtA + config.timeLockPeriod);
      expect(stakerData.owedRewards).to.eq(0n);
    });

    it("Can stake a second time as the same user successfully", async () => {
      await time.increase(config.periodLength * 6n);

      const pendingRewards = await contract.connect(stakerA).getPendingRewards();

      const stakeBalanceBeforeA = await stakeToken.balanceOf(stakerA.address);
      const rewardsBalanceBeforeA = await rewardsToken.balanceOf(stakerA.address);

      await contract.connect(stakerA).stake(DEFAULT_STAKED_AMOUNT);
      stakedAtA = BigInt(await time.latest());
      amountStakedA += DEFAULT_STAKED_AMOUNT;

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

      await contract.connect(stakerA).claim();
      claimedAtA = BigInt(await time.latest());

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
      ).to.be.revertedWith(ONLY_OWNER_ERR);
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
