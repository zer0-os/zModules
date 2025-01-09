import assert from "assert";
import { IStakingERC721DeployArgs } from "../../campaign/types";


export const getStaking721DeployConfig = (
  env : string,
  mockTokens : boolean,
  config ?: IStakingERC721DeployArgs
) : IStakingERC721DeployArgs | undefined => {
  let configReturn;

  // TODO dep: what is this and why do we need it? No need for this extra env var here,
  //  just use default values in "dev" if `config` is not provided
  if (env === "dev" && process.env.STAKING721_USE_DEV_ENV_VALUES !== "true") {
    configReturn = config;
  } else {
    if (
      !process.env.STAKING721_TOKEN_NAME ||
      !process.env.STAKING721_TOKEN_SYMBOL ||
      !process.env.STAKING721_BASE_URI ||
      !process.env.STAKING721_STAKING_TOKEN ||
      !process.env.STAKING721_REWARDS_TOKEN ||
      !process.env.STAKING721_REP_TOKEN ||
      !process.env.STAKING721_REWARDS_PER_PERIOD ||
      !process.env.STAKING721_PERIOD_LENGTH ||
      !process.env.STAKING721_MIN_LOCK_TIME ||
      !process.env.STAKING721_CONTRACT_OWNER ||
      !process.env.STAKING721_MIN_REWARDS_MULTIPLIER ||
      !process.env.STAKING721_MAX_REWARDS_MULTIPLIER
    ) {
      throw new Error("Missing required env variables for StakingERC721!");
    }

    if (
      env === "prod" &&
      (!process.env.STAKING721_STAKING_TOKEN ||
        !process.env.STAKING721_REWARDS_TOKEN)
    ) {
      throw new Error("Missing required env tokens for StakingERC721!");
    }

    configReturn = {
      name: process.env.STAKING721_TOKEN_NAME,
      symbol: process.env.STAKING721_TOKEN_SYMBOL,
      baseUri: process.env.STAKING721_BASE_URI,
      stakingToken: process.env.STAKING721_STAKING_TOKEN,
      rewardsToken: process.env.STAKING721_REWARDS_TOKEN,
      rewardsPerPeriod: BigInt(process.env.STAKING721_REWARDS_PER_PERIOD),
      periodLength: BigInt(process.env.STAKING721_PERIOD_LENGTH),
      minimumLockTime: BigInt(process.env.STAKING721_MIN_LOCK_TIME),
      contractOwner: process.env.STAKING721_CONTRACT_OWNER,
      minimumRewardsMultiplier: BigInt(process.env.STAKING721_MIN_REWARDS_MULTIPLIER),
      maximumRewardsMultiplier: BigInt(process.env.STAKING721_MAX_REWARDS_MULTIPLIER),
    };
  }

  if (env === "dev" || env === "test") {
    if (!mockTokens) {
      assert.ok(
        !!configReturn?.stakingToken && !!configReturn?.rewardsToken,
        "Must provide token addresses for StakingERC721 when not mocking!"
      );
    }
  } else {
    assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
  }

  return configReturn;
};

