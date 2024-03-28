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

  let stakedOrClaimedAt : bigint; // need?
  let pendingRewards : bigint;

  // Function for default stake
  let defaultStake : (amount ?: bigint) => Promise<void>;

  before(async () => {
    [
      deployer,
      staker,
      notStaker
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

      pendingRewards += calcRewardsAmount(
        config,
        stakeAmount,
        config.timeLockPeriod
      );

      // Update stake date
      stakedOrClaimedAt = await stakingERC20.stakedOrClaimedAt(staker.address);
    }
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
      await time.increase(config.timeLockPeriod / 2n);
      const balanceBefore = await mockStakeToken.balanceOf(await staker.getAddress());

      await defaultStake();

      const balanceAfter = await mockStakeToken.balanceOf(await staker.getAddress());

      expect(balanceAfter).to.equal(balanceBefore - DEFAULT_STAKE_ERC20);
    });
  });

  describe("#viewRemainingTimeLock", () => {
    it("Allows the user to view the remaining time lock period", async () => {
      const remainingTimeLock = await stakingERC20.connect(staker).viewRemainingLockTime();

      // TODO other tests above may modify the remaining timestamp here?
      expect(remainingTimeLock).to.eq(config.timeLockPeriod);
    });
  });

  describe("#viewPendingRewards", () => {
    it("Allows the user to view their pending rewards", async () => {
      await time.increase(config.timeLockPeriod);

      const rewards = await stakingERC20.connect(staker).viewPendingRewards();

      const expectedRewards = calcRewardsAmount(
        config,
        DEFAULT_STAKE_ERC20,
        config.timeLockPeriod
      );

      expect(rewards).to.eq(expectedRewards);
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