import {
  MockERC721,
  MockERC20, ZeroVotingERC20, ZeroVotingERC721,
} from "../../../typechain";

import {
  BaseConfig,
} from "./types";

import {
  DEFAULT_PERIOD_LENGTH_ERC721,
  PRECISION_DIVISOR,
  DEFAULT_REWARDS_PER_PERIOD_ERC20,
  DEFAULT_REWARDS_PER_PERIOD_ERC721,
  LOCKED_PRECISION_DIVISOR,
  DEFAULT_PERIOD_LENGTH_ERC20,
  DEFAULT_MINIMUM_LOCK,
  DEFAULT_MINIMUM_RM,
  DEFAULT_MAXIMUM_RM,
} from "../constants";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

export const createDefaultConfig = async (
  rewardsERC20 : MockERC20,
  contractOwner : SignerWithAddress,
  erc721 ?: MockERC721,
  stakeERC20 ?: MockERC20,
  stakeRepERC20 ?: ZeroVotingERC20,
  stakeRepERC721 ?: ZeroVotingERC721,
) => {
  const config : Partial<BaseConfig> = {
    rewardsToken: await rewardsERC20.getAddress(),
    minimumLockTime: DEFAULT_MINIMUM_LOCK,
    divisor: PRECISION_DIVISOR,
    lockedDivisor: LOCKED_PRECISION_DIVISOR,
    minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
    maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
    contractOwner: contractOwner.address,
  };

  if (erc721) {
    config.stakingToken = await erc721.getAddress();
    config.rewardsPerPeriod = DEFAULT_REWARDS_PER_PERIOD_ERC721;
    config.periodLength = DEFAULT_PERIOD_LENGTH_ERC721;
    config.stakeRepToken = await (stakeRepERC721 as ZeroVotingERC721).getAddress();

    return config as BaseConfig;
  } else if (stakeERC20) {
    config.stakingToken = await stakeERC20.getAddress();
    config.rewardsPerPeriod = DEFAULT_REWARDS_PER_PERIOD_ERC20;
    config.periodLength = DEFAULT_PERIOD_LENGTH_ERC20;
    config.stakeRepToken = await (stakeRepERC20 as ZeroVotingERC20).getAddress();

    return config as BaseConfig;
  }

  throw new Error("No valid staking token provided");
};
