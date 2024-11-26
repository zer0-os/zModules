import { DAY_IN_SECONDS, DEFAULT_MULTIPLIER, DEFAULT_PERIOD_LENGTH, DEFAULT_REWARDS_PER_PERIOD, LOCKED_PRECISION_DIVISOR, PRECISION_DIVISOR } from "./constants";
import * as hre from "hardhat";

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

export const calcTotalUnlockedRewards = (
  durations : Array<bigint>,
  balances : Array<bigint>,
  rewardsPerPeriod : bigint = DEFAULT_REWARDS_PER_PERIOD,
  periodLength : bigint = DEFAULT_PERIOD_LENGTH,
  divisor : bigint = PRECISION_DIVISOR
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcUnlockedRewards(
      durations[i],
      balances[i],
      rewardsPerPeriod,
      periodLength,
      divisor
    );
  }

  return totalRewards;
}

export const calcUnlockedRewards = (
  duration : bigint,
  balance : bigint,
  rewardsPerPeriod : bigint,
  periodLength : bigint,
  divisor : bigint
) => {
  const retval = balance * (rewardsPerPeriod * duration) / periodLength / divisor;
  return retval;
}

// TODO should use the config as values, not default
export const calcLockedRewards = (
  duration : bigint,
  balance : bigint,
  rewardsMultiplier : bigint,
  rewardsPerPeriod : bigint = DEFAULT_REWARDS_PER_PERIOD,
  periodLength : bigint = DEFAULT_PERIOD_LENGTH,
  divisor : bigint = LOCKED_PRECISION_DIVISOR
) => {
  const retval = rewardsMultiplier * calcUnlockedRewards(duration, balance, rewardsPerPeriod, periodLength, divisor);
  console.log(retval)
  return retval
}

export const calcTotalLockedRewards = (
  durations : Array<bigint>,
  balances : Array<bigint>,
  rewardsMultiplier : bigint,
  rewardsPerPeriod : bigint = DEFAULT_REWARDS_PER_PERIOD,
  periodLength : bigint = DEFAULT_PERIOD_LENGTH,
  divisor : bigint = LOCKED_PRECISION_DIVISOR
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcLockedRewards(
      durations[i],
      balances[i],
      rewardsMultiplier,
      rewardsPerPeriod,
      periodLength,
      divisor
  );
  }

  return totalRewards;
}