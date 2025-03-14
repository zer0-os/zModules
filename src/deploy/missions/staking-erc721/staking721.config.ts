import assert from "assert";
import {
  IStakingERC721Config,
} from "../../campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { EnvironmentLevels } from "@zero-tech/zdc";


export const getStaking721DeployConfig = ({
  contractOwner,
} : {
  contractOwner ?: SignerWithAddress;
} = {}) : IStakingERC721Config => {
  const env = process.env.ENV_LEVEL;

  let owner;
  if (!contractOwner) {
    assert.ok(
      process.env.STAKING721_CONTRACT_OWNER,
      "Missing STAKING721_CONTRACT_OWNER env variable for StakingERC721!"
    );
    owner = process.env.STAKING721_CONTRACT_OWNER;
  } else {
    owner = contractOwner.address;
  }

  if (
    !process.env.STAKING721_REWARDS_PER_PERIOD ||
    !process.env.STAKING721_PERIOD_LENGTH ||
    !process.env.STAKING721_MIN_LOCK_TIME ||
    !process.env.STAKING721_MIN_REWARDS_MULTIPLIER ||
    !process.env.STAKING721_MAX_REWARDS_MULTIPLIER ||
    !process.env.STAKING721_CAN_EXIT
  ) {
    throw new Error("Missing required env variables for StakingERC721!");
  }

  if (
    env === EnvironmentLevels.prod &&
        (!process.env.STAKING721_STAKING_TOKEN ||
          !process.env.STAKING721_REWARDS_TOKEN)
  ) {
    throw new Error("Missing required env tokens for StakingERC721!");
  }

  const mockTokens =
      (env === EnvironmentLevels.dev || env === EnvironmentLevels.test) &&
      (!process.env.STAKING721_STAKING_TOKEN || !process.env.STAKING721_REWARDS_TOKEN);

  if (env === EnvironmentLevels.dev || env === EnvironmentLevels.test) {
    if (!mockTokens) {
      assert.ok(
        !!process.env.STAKING721_STAKING_TOKEN && !!process.env.STAKING721_REWARDS_TOKEN,
        "Must provide token addresses for StakingERC721 when not mocking!"
      );
    }
  } else {
    assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
  }

  const config = {
    mockTokens,
    shouldRevokeAdminRole: process.env.STAKING721_REVOKE_ADMIN_ROLE === "true",
    stakingToken: process.env.STAKING721_STAKING_TOKEN,
    rewardsToken: process.env.STAKING721_REWARDS_TOKEN,
    rewardsPerPeriod: BigInt(process.env.STAKING721_REWARDS_PER_PERIOD),
    periodLength: BigInt(process.env.STAKING721_PERIOD_LENGTH),
    minimumLockTime: BigInt(process.env.STAKING721_MIN_LOCK_TIME),
    contractOwner: owner,
    minimumRewardsMultiplier: BigInt(process.env.STAKING721_MIN_REWARDS_MULTIPLIER),
    maximumRewardsMultiplier: BigInt(process.env.STAKING721_MAX_REWARDS_MULTIPLIER),
    canExit: process.env.STAKING721_CAN_EXIT === "true",
  };

  return config;
};
