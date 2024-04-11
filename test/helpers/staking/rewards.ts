import { PoolConfig, RewardsConfig } from "./types";


export const calcTotalRewards = (
  durations : Array<bigint>,
  balances : Array<bigint>,
  config : PoolConfig
) => {
  let totalRewards = BigInt(0);

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcRewardsAmount(durations[i], balances[i], config);
  }

  return totalRewards;
}

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
