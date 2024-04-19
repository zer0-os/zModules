import {
  MockERC721,
  MockERC20,
  MockERC1155,
} from "../../../typechain";

import {
  BaseConfig,
} from "./types";

import {
  DEFAULT_LOCK_TIME,
  DEFAULT_PERIOD_LENGTH,
  DEFAULT_REWARDS_PER_PERIOD,
} from "./constants";

export const createDefaultConfigs = async (
  rewardsERC20 : MockERC20,
  erc721 ?: MockERC721,
  stakeERC20 ?: MockERC20,
) => {
  if (erc721) {
    return {
      stakingToken: await erc721.getAddress(),
      rewardsToken: await rewardsERC20.getAddress(),
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD,
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
    } as BaseConfig;
  } else if (stakeERC20) {
    return {
      stakingToken: await stakeERC20.getAddress(),
      rewardsToken: await rewardsERC20.getAddress(),
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD,
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
    } as BaseConfig;
  }

  throw new Error("No valid staking token provided");
};