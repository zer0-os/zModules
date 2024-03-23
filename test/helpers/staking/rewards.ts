import { RewardsConfig } from "./types";


// TODO st: fix this when formula is done
export const calcRewardsAmount = ({
  timePassed,
  rewardWeightMult,
  rewardWeightDiv,
  rewardPeriod,
  stakeAmount,
}: RewardsConfig) => {
  return rewardWeightMult * stakeAmount * timePassed / rewardPeriod / rewardWeightDiv;
}
