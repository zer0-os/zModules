import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseConfig, createDefaultStakingConfig } from "./helpers/staking";
import { MockERC20, StakingBase } from "../typechain";
import { expect } from "chai";
import {
  CANT_ACCEPT_NATIVE_TOKEN_ERR,
  INVALID_ADDR_ERR,
  INVALID_MULTIPLIER_ERR,
  ZERO_INIT_ERR,
  CONFIG_TOO_SOON_ERR,
} from "./helpers/errors";
import { time } from "@nomicfoundation/hardhat-network-helpers";


describe("StakingBase Unit Tests", () => {
  let owner : SignerWithAddress;

  let config : BaseConfig;

  let stakingBase : StakingBase;
  let mockRewards : MockERC20;
  let mockStaking : MockERC20;
  let mockStakeRep : MockERC20;

  before(async () => {
    [owner] = await hre.ethers.getSigners();

    const erc20Factory = await hre.ethers.getContractFactory("MockERC20");
    mockRewards = await erc20Factory.deploy("reward", "symbol");
    mockStaking = await erc20Factory.deploy("stake", "symbol");
    mockStakeRep = await erc20Factory.deploy("stakeRep", "symbol");

    const factory = await hre.ethers.getContractFactory("StakingBase");

    config = await createDefaultStakingConfig(
      false
    );

    stakingBase = await factory.deploy(
      owner,
      await mockStaking.getAddress(),
      await mockRewards.getAddress(),
      await mockStakeRep.getAddress(),
      config
    );
  });

  describe("#receive()", () => {
    it("Fails when sending gas token when rewardsToken is NOT a native (gas) token", async () => {
    // send ETH to the contract
      await expect(
        owner.sendTransaction({
          to: stakingBase.target,
          value: 1,
        })).to.be.revertedWithCustomError(stakingBase, CANT_ACCEPT_NATIVE_TOKEN_ERR);
    });

    it("Succeeds when sending gas token when rewardsToken is a native (gas) token", async () => {
      const factory = await hre.ethers.getContractFactory("StakingBase");

      const localConfig = await createDefaultStakingConfig(
        false
      );

      const contract = await factory.deploy(
        owner.address,
        await mockStaking.getAddress(),
        hre.ethers.ZeroAddress,
        await mockStakeRep.getAddress(),
        localConfig
      );

      const msgValue = 1523n;

      const contractEthBalBefore = await hre.ethers.provider.getBalance(contract.target);

      await owner.sendTransaction({
        to: contract.target,
        value: msgValue,
      });

      const contractEthBalAfter = await hre.ethers.provider.getBalance(contract.target);

      expect(contractEthBalAfter).to.eq(contractEthBalBefore + msgValue);
    });
  });

  describe("Deploy", () => {
    it("Fails when rewardsPerPeriod is 0", async () => {
      const localFactory = await hre.ethers.getContractFactory("StakingBase");

      const localConfig = await createDefaultStakingConfig(
        false
      );

      localConfig.rewardsPerPeriod = 0n;

      await expect(localFactory.deploy(
        owner,
        await mockStaking.getAddress(),
        await mockRewards.getAddress(),
        await mockStakeRep.getAddress(),
        localConfig
      )).to.be.revertedWithCustomError(stakingBase, ZERO_INIT_ERR);
    });

    it("Fails when periodLength is 0", async () => {
      const localFactory = await hre.ethers.getContractFactory("StakingBase");

      const localConfig = await createDefaultStakingConfig(
        false
      );

      localConfig.periodLength = 0n;

      await expect(localFactory.deploy(
        owner,
        await mockStaking.getAddress(),
        await mockRewards.getAddress(),
        await mockStakeRep.getAddress(),
        localConfig
      )).to.be.revertedWithCustomError(stakingBase, ZERO_INIT_ERR);
    });

    it("Fails when stakeRepToken is not a contract", async () => {
      const localFactory = await hre.ethers.getContractFactory("StakingBase");

      await expect(localFactory.deploy(
        owner,
        await mockStaking.getAddress(),
        await mockRewards.getAddress(),
        owner.address,
        config
      )).to.be.revertedWithCustomError(stakingBase, INVALID_ADDR_ERR);
    });

    it("Fails when maximumRewardsMultiplier is less than minimumRewardsMultiplier", async () => {
      const localFactory = await hre.ethers.getContractFactory("StakingBase");

      const localConfig = { ...config };
      localConfig.maximumRewardsMultiplier = localConfig.minimumRewardsMultiplier - 1n;

      await expect(localFactory.deploy(
        owner,
        await mockStaking.getAddress(),
        await mockRewards.getAddress(),
        await mockStakeRep.getAddress(),
        localConfig
      )).to.be.revertedWithCustomError(stakingBase, INVALID_MULTIPLIER_ERR);
    });
  });

  describe("#setRewardConfig", () => {
    it("Fails when new min multiplier is greater than the max multiplier", async () => {
      const localConfig = { ...config };
      localConfig.minimumRewardsMultiplier = localConfig.maximumRewardsMultiplier + 1n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setRewardConfig(localConfig))
        .to.be.revertedWithCustomError(stakingBase, INVALID_MULTIPLIER_ERR);
    });

    it("Fails when new max multiplier is less than the min multiplier", async () => {
      const localConfig = { ...config };
      localConfig.maximumRewardsMultiplier = localConfig.minimumRewardsMultiplier - 1n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setRewardConfig(localConfig))
        .to.be.revertedWithCustomError(stakingBase, INVALID_MULTIPLIER_ERR);
    });

    it("Fails when new period length is 0", async () => {
      const localConfig = { ...config };
      localConfig.periodLength = 0n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setRewardConfig(localConfig))
        .to.be.revertedWithCustomError(stakingBase, ZERO_INIT_ERR);
    });

    it("Succeeds when new max multiplier is equal to min multiplier", async () => {
      const localConfig = { ...config };
      localConfig.maximumRewardsMultiplier = localConfig.minimumRewardsMultiplier;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setRewardConfig(localConfig)).to.not.be.reverted;

      const rewardConfig = await stakingBase.getLatestConfig();

      expect(rewardConfig.minimumRewardsMultiplier).to.eq(localConfig.minimumRewardsMultiplier);
      expect(rewardConfig.maximumRewardsMultiplier).to.eq(localConfig.maximumRewardsMultiplier);
    });

    it("Succeeds when new max multiplier is greater than min multiplier", async () => {
      const localConfig = { ...config };
      localConfig.maximumRewardsMultiplier = localConfig.minimumRewardsMultiplier + 1n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setRewardConfig(localConfig)).to.not.be.reverted;

      const rewardConfig = await stakingBase.getLatestConfig();

      expect(rewardConfig.minimumRewardsMultiplier).to.eq(localConfig.minimumRewardsMultiplier);
      expect(rewardConfig.maximumRewardsMultiplier).to.eq(localConfig.maximumRewardsMultiplier);
    });

    it("Succeeds when new min multiplier is equal to max multiplier", async () => {
      const localConfig = { ...config };
      localConfig.minimumRewardsMultiplier = localConfig.maximumRewardsMultiplier;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setRewardConfig(localConfig)).to.not.be.reverted;

      const rewardConfig = await stakingBase.getLatestConfig();

      expect(rewardConfig.minimumRewardsMultiplier).to.eq(localConfig.minimumRewardsMultiplier);
      expect(rewardConfig.maximumRewardsMultiplier).to.eq(localConfig.maximumRewardsMultiplier);
    });

    it("Succeeds when new min multiplier is less than max multiplier", async () => {
      const localConfig = { ...config };
      localConfig.minimumRewardsMultiplier = localConfig.maximumRewardsMultiplier - 1n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setRewardConfig(localConfig)).to.not.be.reverted;

      const rewardConfig = await stakingBase.getLatestConfig();

      expect(rewardConfig.minimumRewardsMultiplier).to.equal(localConfig.minimumRewardsMultiplier);
      expect(rewardConfig.maximumRewardsMultiplier).to.equal(localConfig.maximumRewardsMultiplier);
    });

    it("Fix - Potential duplicate reward configuration for the same timestamp", async () => {
      const configTimestamp = BigInt(await time.latest()) + 1n;

      const localConfigA = { ...config };
      localConfigA.timestamp = configTimestamp;
      localConfigA.minimumLockTime = config.minimumLockTime * 3n;

      const localConfigB = { ...config };
      localConfigB.timestamp = configTimestamp;
      localConfigB.rewardsPerPeriod = config.rewardsPerPeriod + 12n;

      // Disable auto mining to test both transactions in the same block
      await hre.network.provider.request({
        method: "evm_setAutomine",
        params: [false],
      });


      // Manual `gasLimit` is required to include multiple tx's in a single block
      await stakingBase.connect(owner).setRewardConfig(
        localConfigA,
        {
          gasLimit: 500000,
        }
      );

      // Set back to true
      await hre.network.provider.request({
        method: "evm_setAutomine",
        params: [true],
      });

      // New call will be in the same block as the prior call and will fail
      await expect(stakingBase.connect(owner).setRewardConfig(
        localConfigB,
        {
          gasLimit: 500000,
        }
      )).to.be.revertedWithCustomError(stakingBase, CONFIG_TOO_SOON_ERR);
    });
  });
});
