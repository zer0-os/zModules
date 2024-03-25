import {
  MockERC721,
  MockERC20,
  MockERC1155,
} from "../../../typechain";

import {
  Maybe,
  PoolConfig,
  TokenType,
} from "./types";

import { ethers } from "hardhat";
import { dayInSeconds } from "./constants";

export const DEFAULT_PERIOD_LENGTH = dayInSeconds * 5n;
export const DEFAULT_LOCK_TIME = DEFAULT_PERIOD_LENGTH;

export const createDefaultConfigs = async (
  rewardsERC20 : MockERC20,
  erc721 ?: MockERC721,
  erc1155 ?: MockERC1155,
  stakeERC20 ?: MockERC20,
) => {
  if (erc721) {
    return {
      stakingToken: await erc721.getAddress(),
      rewardsToken: await rewardsERC20.getAddress(),
      poolWeight: ethers.parseEther("5"),
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
    } as PoolConfig;
  } else if (stakeERC20) {
    return {
      stakingToken: await stakeERC20.getAddress(),
      rewardsToken: await rewardsERC20.getAddress(),
      poolWeight: BigInt(800),
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
    } as PoolConfig;
  } else if (erc1155) {
    return {
      stakingToken: await erc1155.getAddress(),
      rewardsToken: await rewardsERC20.getAddress(),
      poolWeight: BigInt(800),
      periodLength: DEFAULT_PERIOD_LENGTH,
      timeLockPeriod: DEFAULT_LOCK_TIME,
    } as PoolConfig;
  }

  throw new Error("No valid staking token provided");
};