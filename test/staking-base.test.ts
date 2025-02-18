import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseConfig, createDefaultStakingConfig } from "./helpers/staking";
import { MockERC20, StakingBase, ZeroVotingERC20 } from "../typechain";
import { expect } from "chai";
import { INVALID_ADDR_ERR, INVALID_MULTIPLIER_ERR, ZERO_INIT_ERR } from "./helpers/errors";
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
  })

  describe("#setConfig", () => {
    it("Fails when new min multiplier is greater than the max multiplier", async () => {
      const localConfig = { ...config };
      localConfig.minimumRewardsMultiplier = localConfig.maximumRewardsMultiplier + 1n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(localConfig))
        .to.be.revertedWithCustomError(stakingBase, INVALID_MULTIPLIER_ERR);
    });

    it("Fails when new max multiplier is less than the min multiplier", async () => {
      const localConfig = { ...config };
      localConfig.maximumRewardsMultiplier = localConfig.minimumRewardsMultiplier - 1n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(localConfig))
        .to.be.revertedWithCustomError(stakingBase, INVALID_MULTIPLIER_ERR);
    });

    it("Fails when new period length is 0", async () => {
      const localConfig = { ...config };
      localConfig.periodLength = 0n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(localConfig))
        .to.be.revertedWithCustomError(stakingBase, ZERO_INIT_ERR);
    });

    it("Succeeds when new max multiplier is equal to min multiplier", async () => {
      const localConfig = { ...config };
      localConfig.maximumRewardsMultiplier = localConfig.minimumRewardsMultiplier;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(localConfig)).to.not.be.reverted;

      expect(await stakingBase.getMinimumRewardsMultiplier()).to.eq(localConfig.minimumRewardsMultiplier);
      expect(await stakingBase.getMaximumRewardsMultiplier()).to.eq(localConfig.maximumRewardsMultiplier);
    });

    it("Succeeds when new max multiplier is greater than min multiplier", async () => {
      const localConfig = { ...config };
      localConfig.maximumRewardsMultiplier = localConfig.minimumRewardsMultiplier + 1n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(localConfig)).to.not.be.reverted;

      expect(await stakingBase.getMinimumRewardsMultiplier()).to.eq(localConfig.minimumRewardsMultiplier);
      expect(await stakingBase.getMaximumRewardsMultiplier()).to.eq(localConfig.maximumRewardsMultiplier);
    });

    it("Succeeds when new min multiplier is equal to max multiplier", async () => {
      const localConfig = { ...config };
      localConfig.minimumRewardsMultiplier = localConfig.maximumRewardsMultiplier;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(localConfig)).to.not.be.reverted;

      expect(await stakingBase.getMinimumRewardsMultiplier()).to.eq(localConfig.minimumRewardsMultiplier);
      expect(await stakingBase.getMaximumRewardsMultiplier()).to.eq(localConfig.maximumRewardsMultiplier);
    });

    it("Succeeds when new min multiplier is less than max multiplier", async () => {
      const localConfig = { ...config };
      localConfig.minimumRewardsMultiplier = localConfig.maximumRewardsMultiplier - 1n;
      localConfig.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(localConfig)).to.not.be.reverted;

      expect(await stakingBase.getMinimumRewardsMultiplier()).to.equal(localConfig.minimumRewardsMultiplier);
      expect(await stakingBase.getMaximumRewardsMultiplier()).to.equal(localConfig.maximumRewardsMultiplier);
    });

    it("#getStakingToken() should return correct value", async () => {
      expect(await stakingBase.getStakingToken()).to.equal(await mockStaking.getAddress());
    });

    it("#getRewardsToken() should return correct value", async () => {
      expect(await stakingBase.getRewardsToken()).to.equal(await mockRewards.getAddress());
    });

    it("#getStakeRepToken() should return correct value", async () => {
      expect(await stakingBase.getStakeRepToken()).to.equal(await (mockStakeRep as ZeroVotingERC20).getAddress());
    });
  });
});
