

export const calcTotalRewards = (
  startTimestamp : bigint,
  currentTimestamp : bigint,
  durations : Array<bigint>,
  balances : Array<bigint>,
  rewardsPerPeriod : bigint,
  periodLength : bigint
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcRewardsAmount(startTimestamp, currentTimestamp, durations[i], balances[i], rewardsPerPeriod, periodLength);
  }

  return totalRewards;
};

// TODO can simplify these, write out each step for now while debugging

export const calcRewardsAmount = (
  startTimestamp : bigint,
  currentTimestamp : bigint,
  timePassed : bigint,
  stakeAmount : bigint,
  rewardsPerPeriod : bigint,
  periodLength : bigint
) : bigint => {

  // The amount of a single time period that has passed, used for fractional rewards
  const amountOfPeriodPassed = (currentTimestamp - startTimestamp) % periodLength;

  // The amount of full periods that have passed
  const fullPeriodsPassed = timePassed / periodLength;

  if (fullPeriodsPassed === 0n) return amountOfPeriodPassed * ((rewardsPerPeriod * stakeAmount) / periodLength);

  const fixPeriodRewards = rewardsPerPeriod * stakeAmount * fullPeriodsPassed;

  return fixPeriodRewards + ((rewardsPerPeriod * stakeAmount) / periodLength);
}
