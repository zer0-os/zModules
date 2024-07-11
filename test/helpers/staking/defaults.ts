import {
  MockERC721,
  MockERC20,
} from "../../../typechain";

import {
  BaseConfig,
} from "./types";

import {
  DEFAULT_LOCK_TIME,
  DEFAULT_PERIOD_LENGTH,
  DEFAULT_REWARDS_PER_PERIOD,
} from "../constants";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

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
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD,
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
      contractOwner,
    } as BaseConfig;
  } else if (stakeERC20) {
    return {
      stakingToken: await stakeERC20.getAddress(),
      rewardsToken: await rewardsERC20.getAddress(),
      rewardsPerPeriod: DEFAULT_REWARDS_PER_PERIOD,
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
      contractOwner,
    } as BaseConfig;
  }

  throw new Error("No valid staking token provided");
};