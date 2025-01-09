import assert from "assert";
import { IStakingERC20DeployArgs } from "../../campaign/types";


export const getStaking20DeployConfig = (
  env : string,
  mockTokens : boolean,
  config ?: IStakingERC20DeployArgs
) : IStakingERC20DeployArgs | undefined => {
  let configReturn;


  // TODO dep: what is this and why do we need it? No need for this extra env var here,
  //  just use default values in "dev" if `config` is not provided
  if (env === "dev" && process.env.STAKING20_USE_DEV_ENV_VALUES !== "true") {
    configReturn = config;
  } else {
    if (
      !process.env.STAKING20_REWARDS_PER_PERIOD ||
      !process.env.STAKING20_PERIOD_LENGTH ||
      !process.env.STAKING20_MIN_LOCK_TIME ||
      !process.env.STAKING20_CONTRACT_OWNER ||
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

    configReturn = {
      stakingToken: process.env.STAKING20_STAKING_TOKEN,
      rewardsToken: process.env.STAKING20_REWARDS_TOKEN,
      stakeRepToken: !!process.env.STAKING20_REP_TOKEN ? process.env.STAKING20_REP_TOKEN : undefined,
      rewardsPerPeriod: BigInt(process.env.STAKING20_REWARDS_PER_PERIOD),
      periodLength: BigInt(process.env.STAKING20_PERIOD_LENGTH),
      minimumLockTime: BigInt(process.env.STAKING20_MIN_LOCK_TIME),
      contractOwner: process.env.STAKING20_CONTRACT_OWNER,
      minimumRewardsMultiplier: BigInt(process.env.STAKING20_MIN_REWARDS_MULTIPLIER),
      maximumRewardsMultiplier: BigInt(process.env.STAKING20_MAX_REWARDS_MULTIPLIER),
    };
  }

  if (env === "dev" || env === "test") {
    if (!mockTokens) {
      assert.ok(
        !!configReturn?.stakingToken && !!configReturn?.rewardsToken,
        "Must provide token addresses for StakingERC20 when not mocking!"
      );
    }
  } else {
    assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
  }

  return configReturn;
};
