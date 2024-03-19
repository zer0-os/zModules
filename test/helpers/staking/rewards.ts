

// TODO st: fix this when formula is done
export const calcRewardsAmount = ({
  timePassed,
  rewardWeight,
  rewardPeriod,
  stakeAmount,
} : {
  timePassed : bigint;
  rewardWeight : bigint;
  rewardPeriod : bigint;
  stakeAmount : bigint;
}) => rewardWeight * stakeAmount * timePassed / rewardPeriod;
