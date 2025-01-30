import assert from "assert";
import { IStakingERC20Config } from "../../campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export const getStaking20DeployConfig = ({
  contractOwner,
} : {
  contractOwner ?: SignerWithAddress;
} = {}) : IStakingERC20Config | undefined => {
  const env = process.env.ENV_LEVEL;

  let owner;
  if (!contractOwner) {
    assert.ok(
      process.env.STAKING20_CONTRACT_OWNER,
      "Missing STAKING20_CONTRACT_OWNER env variable for StakingERC20!"
    );
    owner = process.env.STAKING20_CONTRACT_OWNER;
  } else {
    owner = contractOwner.address;
  }

  if (
    !process.env.STAKING20_REWARDS_PER_PERIOD ||
      !process.env.STAKING20_PERIOD_LENGTH ||
      !process.env.STAKING20_MIN_LOCK_TIME ||
      !process.env.STAKING20_MIN_REWARDS_MULTIPLIER ||
      !process.env.STAKING20_MAX_REWARDS_MULTIPLIER
  ) {
    throw new Error("Missing required env variables for StakingERC20!");
  }

  if (
    env === "prod" &&
        (!process.env.STAKING20_STAKING_TOKEN ||
          !process.env.STAKING20_REWARDS_TOKEN)
  ) {
    throw new Error("Missing required env tokens for StakingERC20!");
  }

  const mockTokens = process.env.MOCK_TOKENS === "true";

  if (env === "dev" || env === "test") {
    if (!mockTokens) {
      assert.ok(
        !!process.env.STAKING20_STAKING_TOKEN && !!process.env.STAKING20_REWARDS_TOKEN,
        "Must provide token addresses for StakingERC20 when not mocking!"
      );
    }
  } else {
    assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
  }

  const config = {
    stakingToken: process.env.STAKING20_STAKING_TOKEN,
    rewardsToken: process.env.STAKING20_REWARDS_TOKEN,
    stakeRepToken: !!process.env.STAKING20_REP_TOKEN ? process.env.STAKING20_REP_TOKEN : undefined,
    rewardsPerPeriod: BigInt(process.env.STAKING20_REWARDS_PER_PERIOD),
    periodLength: BigInt(process.env.STAKING20_PERIOD_LENGTH),
    minimumLockTime: BigInt(process.env.STAKING20_MIN_LOCK_TIME),
    contractOwner: owner,
    minimumRewardsMultiplier: BigInt(process.env.STAKING20_MIN_REWARDS_MULTIPLIER),
    maximumRewardsMultiplier: BigInt(process.env.STAKING20_MAX_REWARDS_MULTIPLIER),
  };

  return config;
};
