import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseConfig, createDefaultStakingConfig } from "./helpers/staking";
import { MockERC20, StakingBase, ZeroVotingERC20 } from "../typechain";
import { expect } from "chai";
import { INVALID_MULTIPLIER_ERR, ZERO_INIT_ERR } from "./helpers/errors";
import { time } from "@nomicfoundation/hardhat-network-helpers";


describe("StakingBase Unit Tests", () => {
  let owner : SignerWithAddress;

  let initialConfig : BaseConfig;

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

    initialConfig = await createDefaultStakingConfig(
      false
    );

    stakingBase = await factory.deploy(
      owner,
      await mockStaking.getAddress(),
      await mockRewards.getAddress(),
      await mockStakeRep.getAddress(),
      initialConfig
    );
  });

  describe("#setConfig", () => {
    it("Fails when new min multiplier is greater than the max multiplier", async () => {
      const config = { ...initialConfig };
      config.minimumRewardsMultiplier = config.maximumRewardsMultiplier + 1n;
      config.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(config))
        .to.be.revertedWithCustomError(stakingBase, INVALID_MULTIPLIER_ERR);
    });

    it("Fails when new max multiplier is less than the min multiplier", async () => {
      const config = { ...initialConfig };
      config.maximumRewardsMultiplier = config.minimumRewardsMultiplier - 1n;
      config.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(config))
        .to.be.revertedWithCustomError(stakingBase, INVALID_MULTIPLIER_ERR);
    });

    it("Fails when new period length is 0", async () => {
      const config = { ...initialConfig };
      config.periodLength = 0n;
      config.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(config))
        .to.be.revertedWithCustomError(stakingBase, ZERO_INIT_ERR);
    });

    it("Succeeds when new max multiplier is equal to or greater than min multiplier", async () => {
      const config = { ...initialConfig };
      config.maximumRewardsMultiplier = config.minimumRewardsMultiplier;
      config.timestamp = BigInt(await time.latest()) + 1n;

      await expect(stakingBase.connect(owner).setConfig(config)).to.not.be.reverted;

      expect(await stakingBase.getMinimumRewardsMultiplier()).to.equal(config.minimumRewardsMultiplier);
      expect(await stakingBase.getMaximumRewardsMultiplier()).to.equal(config.maximumRewardsMultiplier);
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
