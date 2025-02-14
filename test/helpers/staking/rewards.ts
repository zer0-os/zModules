import { time } from "@nomicfoundation/hardhat-network-helpers";
import { LOCKED_PRECISION_DIVISOR, PRECISION_DIVISOR } from "../constants";
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

export const calcUpdatedStakeRewards = async (
  timeOrDuration : bigint,
  amount : bigint,
  locked : boolean,
  configs : BaseConfig[]
) => {
  if (locked) {
    // Simply return calculation from latest config when locked
    const config = configs[configs.length - 1];
    return calcRewardsMultiplier(timeOrDuration, config) 
      * amount * config.rewardsPerPeriod * timeOrDuration / config.periodLength / LOCKED_PRECISION_DIVISOR;
  }

  let rewards = 0n
  let duration = BigInt(await time.latest()) - timeOrDuration;
  let lastTimestamp = BigInt(await time.latest()); // TODO maybe also off by 1 error depending when this happens relative to claim

  let i = configs.length;
  for (i; i > 0; --i) {
    // console.log("rewards so far: ", rewards);
    // console.log("h: i: ", i - 1);
    const config = configs[i - 1];

    if (config.timestamp > timeOrDuration) {
      // console.log("h: stake WAS before last config change");

      const effectiveDuration = lastTimestamp - config.timestamp;
      lastTimestamp = config.timestamp;
      duration -= effectiveDuration;

      const addedAmount = amount * config.rewardsPerPeriod * effectiveDuration / config.periodLength / PRECISION_DIVISOR
      // console.log("h: addedAmount: ", addedAmount);
      
      rewards += addedAmount;
    } else {
      // console.log("stake WAS NOT before last config change");
      const addedAmount = amount * config.rewardsPerPeriod * duration / config.periodLength / PRECISION_DIVISOR

      rewards += addedAmount;
      // console.log("h: addedAmount: ", addedAmount);
      return rewards;
    }
  }

  return rewards;
}
