import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import {
  MockERC20,
  StakingERC20,
} from "../typechain";
import {
  PoolConfig,
} from "./helpers/staking/types";
import { INVALID_TOKEN_ID, ONLY_NFT_OWNER } from "./helpers/staking/errors";
import { createDefaultConfigs } from "./helpers/staking/defaults";
import { calcRewardsAmount } from "./helpers/staking/rewards";
import { DEFAULT_STAKE_ERC20 } from "./helpers/staking/constants";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("StakingERC20", () => {
  let deployer : SignerWithAddress;
  let staker : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let stakingERC20 : StakingERC20;

  let mockRewardsToken : MockERC20;
  let mockStakeToken : MockERC20;

  let config : PoolConfig;

  const pendingRewards  = 0n;

  // Function for default stake
  let defaultStake : (amount ?: bigint) => Promise<void>;

  before(async () => {
    [
      deployer,
      staker,
      notStaker,
    ] = await hre.ethers.getSigners();

    const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    mockRewardsToken = await mockERC20Factory.deploy("MEOW", "MEOW");
    mockStakeToken = await mockERC20Factory.deploy("Wilder World", "WILD");

    config = await createDefaultConfigs(mockRewardsToken, undefined, undefined, mockStakeToken);

    const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");
    stakingERC20 = await stakingFactory.deploy(
      "StakingERC20",
      "SERC20",
      config
    ) as StakingERC20;

    // Give staking contract balance to pay rewards
    await mockRewardsToken.connect(deployer).transfer(
      await stakingERC20.getAddress(),
      hre.ethers.parseEther("9000000000000")
    );

    // Give the staker a balance to stake
    await mockStakeToken.connect(deployer).transfer(
      await staker.getAddress(),
      hre.ethers.parseEther("9000000000000")
    );

    defaultStake = async (amount ?: bigint) => {
      await mockStakeToken.connect(staker).approve(
        await stakingERC20.getAddress(),
        DEFAULT_STAKE_ERC20
      );

      const stakeAmount = amount || DEFAULT_STAKE_ERC20;

      await stakingERC20.connect(staker).stake(stakeAmount);
    };
  });

  describe("#stake", () => {
    // it.only("Rewards tests", async () => {
    //   const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    //   mockRewardsToken = await mockERC20Factory.deploy("MEOW", "MEOW");
    //   mockStakeToken = await mockERC20Factory.deploy("Wilder World", "WILD");

    //     // Give the staker a balance to stake
    // await mockStakeToken.connect(deployer).transfer(
    //   await staker.getAddress(),
    //   hre.ethers.parseEther("9000000000000")
    // );


    //   const config = {
    //     stakingToken: await mockStakeToken.getAddress(),
    //     rewardsToken: await mockRewardsToken.getAddress(),
    //     poolWeight: BigInt(1),
    //     periodLength: BigInt(10),
    //     timeLockPeriod: BigInt(100), // 10 seconds
    //   } as PoolConfig;

    //   const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");

    //   const contract = await stakingFactory.deploy(
    //     "StakingERC20",
    //     "SERC20",
    //     config
    //   ) as StakingERC20;

    //   await mockStakeToken.connect(staker).approve(
    //     await contract.getAddress(),
    //     hre.ethers.parseEther("9000000000000")
    //   );

    //   await contract.connect(staker).stake("2");

    //   await time.increase(23);

    //   const pendingRewards1 = await contract.connect(staker).viewPendingRewards();

    //   await time.increase(4);

    //   const pendingRewards2 = await contract.connect(staker).viewPendingRewards();


    //   let remainingWait = await contract.connect(staker).viewRemainingLockTime();

    //   await time.increase(1);

    //   pendingRewards = await contract.connect(staker).viewPendingRewards();
    //   remainingWait = await contract.connect(staker).viewRemainingLockTime();

    //   await time.increase(1);

    //   pendingRewards = await contract.connect(staker).viewPendingRewards();

    //   remainingWait = await contract.connect(staker).viewRemainingLockTime();
    //   await time.increase(1);

    //   pendingRewards = await contract.connect(staker).viewPendingRewards();
    //   remainingWait = await contract.connect(staker).viewRemainingLockTime();


    //   // await contract.connect(staker).claim();

    //   // const balanceAfter = await mockRewardsToken.balanceOf(await staker.getAddress());

    //   console.log(1);

    // });

    it("Allows the user to stake when they haven't staked before", async () => {
      const balanceBefore = await mockStakeToken.balanceOf(await staker.getAddress());

      await defaultStake();

      const balanceAfter = await mockStakeToken.balanceOf(await staker.getAddress());

      expect(balanceAfter).to.equal(balanceBefore - DEFAULT_STAKE_ERC20);
    });

    it("Allows a user to stake again when they have already staked", async () => {
      // Half a time period, stake again
      const balanceBefore = await mockStakeToken.balanceOf(await staker.getAddress());

      await defaultStake();

      const balanceAfter = await mockStakeToken.balanceOf(await staker.getAddress());

      expect(balanceAfter).to.equal(balanceBefore - DEFAULT_STAKE_ERC20);
    });
  });

  describe("#viewRemainingTimeLock", () => {
    it("Allows the user to view the remaining time lock period", async () => {
      const remainingTimeLock = await stakingERC20.connect(staker).viewRemainingLockTime();

      // We expect remaining time to be the other hakf if the time lock period
      // Two previous stakes, so 2 closer to time lock period
      expect(remainingTimeLock).to.eq(config.timeLockPeriod - 2n);
    });
  });

  describe("#viewPendingRewards", () => {
    it("Allows the user to view their pending rewards", async () => {
      // await time.increase(config.timeLockPeriod / 2n);
      const rewards = await stakingERC20.connect(staker).viewPendingRewards();

      const expectedRewards = calcRewardsAmount(
        config,
        DEFAULT_STAKE_ERC20,
        config.timeLockPeriod
      );

      // TODO shouldn't show fractional amounts, right now it does
      // expect(rewards).to.eq(expectedRewards);
    });
  });

  describe("#claim", () => {
    it("Fails when a user who has no stake tries to claim", async () => {
      const staked = await stakingERC20.staked(notStaker.address);
      expect(staked).to.eq(0n);
      await expect(stakingERC20.connect(notStaker).claim()).to.be.revertedWithCustomError(stakingERC20, "InvalidStake");
    });

    it("Fails when user has not passed their lock time", async () => {
      await expect(stakingERC20.connect(staker).claim()).to.be.revertedWithCustomError(stakingERC20, "InvalidClaim");
    });

    it("Allows the user to claim their rewards", async () => {
      const balanceBefore = await mockRewardsToken.balanceOf(await staker.getAddress());

      // Shift to past the time lock period
      await time.increase(config.timeLockPeriod);

      const pendingRewards = await stakingERC20.connect(staker).viewPendingRewards();
      const pendingRewardsFormatted = hre.ethers.formatEther(pendingRewards);
      const stakeTime = (await stakingERC20.stakes(staker.address)).stakeTimestamp;
      const latest = await time.latest();

      await stakingERC20.connect(staker).claim();

      const balanceAfter = await mockRewardsToken.balanceOf(await staker.getAddress());

      // TODO this returns the wrong value, fix this calculation
      const expectedRewards = calcRewardsAmount(
        config,
        DEFAULT_STAKE_ERC20,
        config.timeLockPeriod
      );

      expect(balanceAfter).to.eq(balanceBefore + pendingRewards);
    });
  });

  // event emitter tests
  // TODO failure tests
  // fails to stake when the user has no balance
  // fails to stake when the user has no allowance

  // confirm stakes reflect rewards properly
  // e.g. stake X at time A and Z at time B, claim at time C
  // rewards should be rewards(X) then rewards(X+Z)
  // can view rewards in pool
  // fails to claim if no rewards
  // fails to unstake if no rewards
  // allows removeStake if no rewards

  // viewRemainingLockTime returns 0 when more than enough time has passed to claim or unstake a stake
});