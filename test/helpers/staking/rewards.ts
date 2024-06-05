

export const calcTotalRewards = (
  timestamp : bigint,
  durations : Array<bigint>,
  balances : Array<bigint>,
  rewardsPerPeriod : bigint,
  periodLength : bigint
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcRewardsAmount(timestamp, durations[i], balances[i], rewardsPerPeriod, periodLength);
  }

  return totalRewards;
};

export const calcRewardsAmount = (
  timestamp : bigint,
  timePassed : bigint,
  stakeAmount : bigint,
  rewardsPerPeriod : bigint,
  periodLength : bigint
) : bigint => {

  const fullPeriodsPassed = timePassed / periodLength;
  const fixPeriodRewards = rewardsPerPeriod * stakeAmount * fullPeriodsPassed;
  
  const amountOfPeriodPassed = periodLength - (timestamp % periodLength);
  
  const userRewardsPerPeriod = fixPeriodRewards / fullPeriodsPassed;
  const rewardsPerPeriodFraction = userRewardsPerPeriod / periodLength;

  return fixPeriodRewards + (rewardsPerPeriodFraction * amountOfPeriodPassed);
}
