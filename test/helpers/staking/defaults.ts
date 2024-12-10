import {
  MockERC721,
  MockERC20,
} from "../../../typechain";

import {
  BaseConfig,
} from "./types";

import {
<<<<<<< HEAD
  DEFAULT_PERIOD_LENGTH_ERC721,
  PRECISION_DIVISOR,
  DEFAULT_REWARDS_PER_PERIOD_ERC20,
  DEFAULT_REWARDS_PER_PERIOD_ERC721,
  LOCKED_PRECISION_DIVISOR,
  // DEFAULT_LOCK_ADJUSTMENT,
  DEFAULT_PERIOD_LENGTH_ERC20,
} from "./constants";
=======
  DEFAULT_LOCK_TIME,
  DEFAULT_PERIOD_LENGTH,
  DEFAULT_REWARDS_PER_PERIOD,
} from "../constants";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
>>>>>>> master

export const createDefaultConfigs = async (
  rewardsERC20 : MockERC20,
  contractOwner : SignerWithAddress,
  erc721 ?: MockERC721,
  stakeERC20 ?: MockERC20,
) => {
  if (erc721) {
    return {
      stakingToken: await erc721.getAddress(),
      rewardsToken: await rewardsERC20.getAddress(),
<<<<<<< HEAD
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD_ERC721,
      periodLength: DEFAULT_PERIOD_LENGTH_ERC721,
      divisor: PRECISION_DIVISOR,
      lockedDivisor: LOCKED_PRECISION_DIVISOR,
      // lockAdjustment: DEFAULT_LOCK_ADJUSTMENT
=======
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD,
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
      contractOwner,
>>>>>>> master
    } as BaseConfig;
  } else if (stakeERC20) {
    return {
      stakingToken: await stakeERC20.getAddress(),
      rewardsToken: await rewardsERC20.getAddress(),
<<<<<<< HEAD
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD_ERC20,
      periodLength: DEFAULT_PERIOD_LENGTH_ERC20,
      divisor: PRECISION_DIVISOR,
      lockedDivisor: LOCKED_PRECISION_DIVISOR,
      // lockAdjustment: DEFAULT_LOCK_ADJUSTMENT
=======
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD,
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
      contractOwner,
>>>>>>> master
    } as BaseConfig;
  }

  throw new Error("No valid staking token provided");
};