import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseConfig, createDefaultStakingConfig } from "./helpers/staking";
import { MockERC20, StakingBase, ZeroVotingERC20 } from "../typechain";
import { expect } from "chai";
import { OWNABLE_UNAUTHORIZED_ERR } from "./helpers/errors";


describe("StakingBase Unit Tests", () => {
  let owner : SignerWithAddress;
  let user : SignerWithAddress;

  let initialConfig : BaseConfig;

  let stakingBase : StakingBase;
  let mockErc1 : MockERC20;
  let mockErc2 : MockERC20;
  let mockErc3 : MockERC20;

  before(async () => {
    [owner, user] = await hre.ethers.getSigners();

    const erc20Fact = await hre.ethers.getContractFactory("MockERC20");
    mockErc1 = await erc20Fact.deploy("reward", "symbol");
    mockErc2 = await erc20Fact.deploy("stake", "symbol");
    mockErc3 = await erc20Fact.deploy("stakeRep", "symbol");

    const fact = await hre.ethers.getContractFactory("StakingBase");

    initialConfig = await createDefaultStakingConfig(
      owner,
      mockErc1,
      undefined,
      mockErc2,
      mockErc3 as ZeroVotingERC20,
      undefined,
    );

    stakingBase = await fact.deploy(initialConfig);
  });

  describe("State Setters & Getters", () => {
    it("#setRewardsPerPeriod() should set value correctly", async () => {
      const rewards = 13546546;
      await stakingBase.connect(owner).setRewardsPerPeriod(rewards);
      expect(await stakingBase.getRewardsPerPeriod()).to.equal(rewards);
    });

    it("#setRewardsPerPeriod() should revert if called by non-owner", async () => {
      await expect(
        stakingBase.connect(user).setRewardsPerPeriod(123),
      ).to.be.revertedWithCustomError(stakingBase, OWNABLE_UNAUTHORIZED_ERR);
    });

    it("#setPeriodLength() should set value correctly", async () => {
      const periodLength = 123;
      await stakingBase.connect(owner).setPeriodLength(periodLength);
      expect(await stakingBase.getPeriodLength()).to.equal(periodLength);
    });

    it("#setPeriodLength() should revert if called by non-owner", async () => {
      await expect(
        stakingBase.connect(user).setPeriodLength(123),
      ).to.be.revertedWithCustomError(stakingBase, OWNABLE_UNAUTHORIZED_ERR);
    });

    it("#setMinimumLockTime() should set value correctly", async () => {
      const minLock = 123;
      await stakingBase.connect(owner).setMinimumLockTime(minLock);
      expect(await stakingBase.getMinimumLockTime()).to.equal(minLock);
    });

    it("#setMinimumLockTime() should revert if called by non-owner", async () => {
      await expect(
        stakingBase.connect(user).setMinimumLockTime(123),
      ).to.be.revertedWithCustomError(stakingBase, OWNABLE_UNAUTHORIZED_ERR);
    });

    it("#setMinimumRewardsMultiplier() should set value correctly", async () => {
      const minRM = 123;
      await stakingBase.connect(owner).setMinimumRewardsMultiplier(minRM);
      expect(await stakingBase.getMinimumRewardsMultiplier()).to.equal(minRM);
    });

    it("#setMinimumRewardsMultiplier() should revert if called by non-owner", async () => {
      await expect(
        stakingBase.connect(user).setMinimumRewardsMultiplier(123),
      ).to.be.revertedWithCustomError(stakingBase, OWNABLE_UNAUTHORIZED_ERR);
    });

    it("#setMaximumRewardsMultiplier() should set value correctly", async () => {
      const maxRM = 123;
      await stakingBase.connect(owner).setMaximumRewardsMultiplier(maxRM);
      expect(await stakingBase.getMaximumRewardsMultiplier()).to.equal(maxRM);
    });

    it("#setMaximumRewardsMultiplier() should revert if called by non-owner", async () => {
      await expect(
        stakingBase.connect(user).setMaximumRewardsMultiplier(123),
      ).to.be.revertedWithCustomError(stakingBase, OWNABLE_UNAUTHORIZED_ERR);
    });

    it("#getStakingToken() should return correct value", async () => {
      expect(await stakingBase.getStakingToken()).to.equal(await mockErc2.getAddress());
    });

    it("#getRewardsToken() should return correct value", async () => {
      expect(await stakingBase.getRewardsToken()).to.equal(await mockErc1.getAddress());
    });

    it("#getStakeRepToken() should return correct value", async () => {
      expect(await stakingBase.getStakeRepToken()).to.equal(await (mockErc3 as ZeroVotingERC20).getAddress());
    });
  });
});
