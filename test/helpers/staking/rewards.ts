

export const calcTotalRewards = (
  durations: Array<bigint>,
  balances: Array<bigint>,
  rewardsPerPeriod: bigint,
  periodLength: bigint
): bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcRewardsAmount(durations[i], balances[i], rewardsPerPeriod, periodLength);
  }

  return totalRewards;
};

export const calcRewardsAmount = (
  timePassed: bigint,
  stakeAmount: bigint,
  rewardsPerPeriod: bigint,
  periodLength: bigint
): bigint => {
  return rewardsPerPeriod * stakeAmount * (timePassed / periodLength);
}
