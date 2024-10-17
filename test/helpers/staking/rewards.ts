import { DAY_IN_SECONDS, DEFAULT_MULTIPLIER } from "./constants";


export const calcTotalRewards = (
  durations : Array<bigint>,
  balances : Array<bigint>,
  rewardsPerPeriod : bigint,
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcRewardsAmount(durations[i], balances[i], rewardsPerPeriod);
  }

  return totalRewards;
};

export const calcRewardsAmount = (
  timeSinceLastClaim : bigint,
  lockDuration : bigint,
  rewardsPerPeriod : bigint,
) : bigint => {
  const exponent = lockDuration > 0n ? 2n : 1n;
  return (rewardsPerPeriod * timeSinceLastClaim**exponent * DEFAULT_MULTIPLIER) / DAY_IN_SECONDS;
}
