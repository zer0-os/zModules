import { PoolConfig, RewardsConfig } from "./types";


export const calcRewardsAmount = (
  config : PoolConfig,
  stakeAmount : bigint,
  timePassed : bigint
) => {
  // Must capture floor of division for truncation to match whats on change
  // This requires converting to Number, then back to BigInt
  const div = Math.floor(Number(timePassed) / Number(config.periodLength));
  return config.poolWeight * stakeAmount * BigInt(div);
  // return config.poolWeight * stakeAmount * timePassed / config.periodLength;
}
