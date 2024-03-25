import { PoolConfig, RewardsConfig } from "./types";


export const calcRewardsAmount = (
  config : PoolConfig,
  stakeAmount : bigint,
  timePassed : bigint
) => {
  return config.poolWeight * stakeAmount * timePassed / config.periodLength;
}
