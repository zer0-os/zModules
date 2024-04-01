import { PoolConfig, RewardsConfig } from "./types";

// if we do math with ETH values it will truncate?

export const calcRewardsAmount = (
  timePassed : bigint,
  stakeAmount : bigint,
  config : PoolConfig,
) => {
  // Must capture floor of division for truncation to match whats on change
  // This requires converting to Number, then back to BigInt
  // const div = Math.floor(Number(timePassed) / Number(config.periodLength));
  return config.poolWeight * stakeAmount * (timePassed / config.periodLength);
  // return config.poolWeight * stakeAmount * (timePassed / config.periodLength);
}
