// import { DAY_IN_SECONDS,
//   DEFAULT_MULTIPLIER,
//   DEFAULT_PERIOD_LENGTH,
//   DEFAULT_REWARDS_PER_PERIOD,
//   LOCKED_PRECISION_DIVISOR,
//   PRECISION_DIVISOR 
// } from "./constants";
import { BaseConfig } from "./types";

import * as hre from "hardhat"

// export const calcTotalRewards = (
//   durations : Array<bigint>,
//   balances : Array<bigint>,
//   rewardsPerPeriod : bigint,
// ) : bigint => {
//   let totalRewards = 0n;

//   for (let i = 0; i < durations.length; i++) {
//     totalRewards += calcRewardsAmount(durations[i], balances[i], rewardsPerPeriod);
//   }

//   return totalRewards;
// };

// export const calcRewardsAmount = ( // TODO shouldnt use these legacy functions, confirm in tests
//   timeSinceLastClaim : bigint,
//   lockDuration : bigint,
//   rewardsPerPeriod : bigint,
// ) : bigint => {
//   const exponent = lockDuration > 0n ? 2n : 1n;
//   return (rewardsPerPeriod * timeSinceLastClaim**exponent * DEFAULT_MULTIPLIER) / DAY_IN_SECONDS;
// }

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

// calc all rewards that accepts array of RMs