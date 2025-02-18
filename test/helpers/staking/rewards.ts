import { BaseConfig } from "./types";

export const calcTotalUnlockedRewards = (
  durations : Array<bigint>,
  balances : Array<bigint>,
  config : BaseConfig
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcStakeRewards(
      balances[i],
      durations[i],
      false,
      config,
    );
  }

  return totalRewards;
};

export const calcLockedRewards = (
  duration : bigint,
  balance : bigint,
  rewardsMultiplier : bigint,
  config : BaseConfig
) => {
  const retval = calcStakeRewards(
    balance,
    duration,
    true,
    config,
    rewardsMultiplier
  );

  return retval;
};

export const calcTotalLockedRewards = (
  durations : Array<bigint>,
  balances : Array<bigint>,
  rewardsMultiplier : bigint,
  config : BaseConfig
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcLockedRewards(
      durations[i],
      balances[i],
      rewardsMultiplier,
      config
    );
  }

  return totalRewards;
};

export const calcRewardsMultiplier = (
  lockDuration : bigint,
  config : BaseConfig
) => config.minimumRewardsMultiplier
    + (config.maximumRewardsMultiplier - config.minimumRewardsMultiplier)
    * (lockDuration)
    / config.periodLength;

export const calcStakeRewards = (
  amount : bigint,
  timeDuration : bigint,
  locked : boolean,
  config : BaseConfig,
  rewardsMultiplier ?: bigint,
) => {
  if (!rewardsMultiplier) {
    rewardsMultiplier = locked ? calcRewardsMultiplier(timeDuration, config) : 1n;
  }

  const divisor = locked ? 100000n : 1000n;

  const rewards =
    rewardsMultiplier * amount * config.rewardsPerPeriod * timeDuration / config.periodLength / divisor;

  return rewards;
};
