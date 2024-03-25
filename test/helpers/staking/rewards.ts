import { RewardsConfig } from "./types";


// TODO st: fix this when formula is done
export const calcRewardsAmount = ({
  timePassed,
  rewardWeight,
  rewardPeriod,
  stakeAmount,
} : RewardsConfig) => {
  return rewardWeight * stakeAmount * timePassed / rewardPeriod;
}
