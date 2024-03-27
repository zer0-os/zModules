import { PoolConfig, RewardsConfig } from "./types";


export const calcRewardsAmount = (
  config : PoolConfig,
  stakeAmount : bigint,
  timePassed : bigint
) => {
  const v = config.poolWeight * stakeAmount * timePassed / config.periodLength;
  return v;
  // return config.poolWeight * stakeAmount * timePassed / config.periodLength;
}
