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

  const duration = BigInt(await time.latest()) - timeOrDuration;

  // can write to incoming values but just for separation
  let durationCopy = duration;

  let rewards = 0n
  let lastTimestamp = BigInt(Math.floor(Date.now() / 1000));

  let i = configs.length;
  for (i; i > 0; --i) {
    const config = configs[i - 1];

    if (timeOrDuration < config.timestamp ) {
      const effectiveDuration = lastTimestamp - config.timestamp;
      lastTimestamp = config.timestamp;
      durationCopy -= effectiveDuration;

      // const a = amount * config.rewardsPerPeriod * effectiveDuration
      // const b = config.periodLength
      // const c = PRECISION_DIVISOR;

      // const x = Math.floor(Number(a) / Number(b) / Number(c));

      // // pick apart the calculation to get the right value that causes rounding error
      // rewards += BigInt(x);

      rewards += amount * config.rewardsPerPeriod * effectiveDuration / config.periodLength / PRECISION_DIVISOR;
    } else {
      // const a = amount * config.rewardsPerPeriod * durationCopy
      // const b = config.periodLength
      // const c = PRECISION_DIVISOR;

      // const x = Math.floor(Number(a) / Number(b) / Number(c));

      rewards += amount * config.rewardsPerPeriod * durationCopy / config.periodLength / PRECISION_DIVISOR;
      return rewards;
    }
  }

  return rewards;
}
