import { 
  MockERC721,
  MockERC20,
  MockERC1155,
} from "../../typechain";

import {
  PoolConfig,
  TokenType
} from "./types";

import { ethers } from "hardhat";

export const DEFAULT_LOCK_TIME = BigInt(1).toString();

export const createDefaultConfigs = async (
  erc721 : MockERC721,
  erc20 : MockERC20,
  erc1155 : MockERC1155,
) => {
  const erc721Config : PoolConfig = {
    stakingToken: await erc721.getAddress(),
    rewardsToken: await erc20.getAddress(),
    stakingTokenType: TokenType.IERC721,
    rewardsPerBlock: ethers.parseEther("100").toString(),
    minRewardsTime: DEFAULT_LOCK_TIME,
  }

  const erc20Config : PoolConfig = {
    stakingToken: await erc20.getAddress(),
    rewardsToken: await erc20.getAddress(),
    stakingTokenType: TokenType.IERC20,
    rewardsPerBlock: ethers.parseEther("100").toString(),
    minRewardsTime: DEFAULT_LOCK_TIME,
  }

  const erc1155Config : PoolConfig = {
    stakingToken: await erc1155.getAddress(),
    rewardsToken: await erc20.getAddress(),
    stakingTokenType: TokenType.IERC1155,
    rewardsPerBlock: ethers.parseEther("100").toString(),
    minRewardsTime: DEFAULT_LOCK_TIME,
  }

  return [ erc721Config, erc20Config, erc1155Config ];
};