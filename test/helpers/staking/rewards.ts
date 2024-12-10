

export const calcTotalRewards = (
  durations : Array<bigint>,
  balances : Array<bigint>,
  rewardsPerPeriod : bigint,
  periodLength : bigint
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcRewardsAmount(durations[i], balances[i], rewardsPerPeriod, periodLength);
  }

  return totalRewards;
};

export const calcRewardsAmount = (
  timePassed : bigint,
  stakeAmount : bigint,
  rewardsPerPeriod : bigint,
  periodLength : bigint
) : bigint => {

  // The amount of a single time period that has passed, used for fractional rewards
  const fractionOfPeriod = timePassed % periodLength;

  const fullPeriodRewards = rewardsPerPeriod * stakeAmount * (timePassed / periodLength);

  return fullPeriodRewards + (fractionOfPeriod * (rewardsPerPeriod * stakeAmount) / periodLength);
};
