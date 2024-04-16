

export const calcTotalRewards = (
  durations : Array<bigint>,
  balances : Array<bigint>,
  poolWeight : bigint,
  periodLength : bigint
) : bigint => {
  let totalRewards = 0n;

  for (let i = 0; i < durations.length; i++) {
    totalRewards += calcRewardsAmount(durations[i], balances[i], poolWeight, periodLength);
  }

  return totalRewards;
};

export const calcRewardsAmount = (
  timePassed : bigint,
  stakeAmount : bigint,
  poolWeight : bigint,
  periodLength : bigint
) : bigint =>
  // Must capture floor of division for truncation to match whats on change
  // This requires converting to Number, then back to BigInt
  // const div = Math.floor(Number(timePassed) / Number(config.periodLength));
  poolWeight * stakeAmount * (timePassed / periodLength);
  // return config.poolWeight * stakeAmount * (timePassed / config.periodLength);

