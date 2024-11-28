import {
  MockERC721,
  MockERC20,
} from "../../../typechain";

import {
  BaseConfig,
} from "./types";

import {
  DEFAULT_PERIOD_LENGTH,
  PRECISION_DIVISOR,
  DEFAULT_REWARDS_PER_PERIOD_ERC20,
  DEFAULT_REWARDS_PER_PERIOD_ERC721,
  LOCKED_PRECISION_DIVISOR,
  DEFAULT_LOCK_ADJUSTMENT,
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
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD_ERC721,
      periodLength: DEFAULT_PERIOD_LENGTH,
      divisor: PRECISION_DIVISOR,
      lockedDivisor: LOCKED_PRECISION_DIVISOR,
      lockAdjustment: DEFAULT_LOCK_ADJUSTMENT
    } as BaseConfig;
  } else if (stakeERC20) {
    return {
      stakingToken: await stakeERC20.getAddress(),
      rewardsToken: await rewardsERC20.getAddress(),
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD_ERC20,
      periodLength: DEFAULT_PERIOD_LENGTH,
      divisor: PRECISION_DIVISOR,
      lockedDivisor: LOCKED_PRECISION_DIVISOR,
      lockAdjustment: DEFAULT_LOCK_ADJUSTMENT
    } as BaseConfig;
  }

  throw new Error("No valid staking token provided");
};