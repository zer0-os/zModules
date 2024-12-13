import { DAY_IN_SECONDS } from "../constants";
import { BaseConfig } from "./types";

import * as hre from "hardhat"

// Pass specific values here from config in other functions so we can use the correct divisor


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
}

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
    * (lockDuration) 
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

  // not correct in case debugger using
  const rewards = 
    rewardsMultiplier * amount * config.rewardsPerPeriod * timeDuration / config.periodLength / divisor;

    return rewards;
}
