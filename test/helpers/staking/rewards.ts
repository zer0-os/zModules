import { DAY_IN_SECONDS } from "../constants";
import { BaseConfig } from "./types";

import * as hre from "hardhat"

// Pass specific values here from config in other functions so we can use the correct divisor
const calcRewards = (
  duration : bigint,
  balance : bigint,
  rewardsPerPeriod : bigint,
  periodLength : bigint,
  divisor : bigint
) => {
  const retval = balance * (rewardsPerPeriod * duration) / periodLength / divisor;
  return retval;
}

export const calcTotalUnlockedRewards = (
  durations : Array<bigint>,
  balances : Array<bigint>,
  config : BaseConfig
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcRewards(
      durations[i],
      balances[i],
      config.rewardsPerPeriod,
      config.periodLength,
      config.divisor
    );
  }

  return totalRewards;
}

export const calcLockedRewards = (
  duration : bigint,
  balance : bigint,
  rewardsMultiplier : bigint,
  config : BaseConfig
) => {
  const retval = rewardsMultiplier * calcRewards(
    duration,
    balance,
    config.rewardsPerPeriod,
    config.periodLength,
    config.lockedDivisor
  );

  return retval;
}

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
}

const calculateRewardsMultiplier = (lockDuration : bigint, config : BaseConfig) => {

  return config.minimumRewardsMultiplier
    + (config.maximumRewardsMultiplier - config.minimumRewardsMultiplier)
    * (lockDuration / DAY_IN_SECONDS) 
    / config.periodLength
}

export const calcStakeRewards = (
  amount : bigint,
  timeDuration : bigint,
  locked : boolean,
  config : BaseConfig,
  rewardsMultiplier ?: bigint,
) => {
  if (!rewardsMultiplier) {
    rewardsMultiplier = locked ? calculateRewardsMultiplier(timeDuration, config) : 1n;
  }

  const divisor = locked ? 100000n : 1000n;

  const rewards = 
    rewardsMultiplier * amount * config.rewardsPerPeriod * timeDuration / config.periodLength / divisor;

    return rewards;
}
