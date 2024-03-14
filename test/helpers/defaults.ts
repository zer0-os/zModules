import { 
  MockERC721,
  MockERC20,
  MockERC1155,
  MockERC1155Receiver
} from "../../typechain";

import {
  PoolConfig,
  TokenType
} from "./types";

import { ethers } from "hardhat";

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
    minRewardsTime: BigInt(15).toString(),
  }

  const erc20Config : PoolConfig = {
    stakingToken: await erc20.getAddress(),
    rewardsToken: await erc20.getAddress(),
    stakingTokenType: TokenType.IERC20,
    rewardsPerBlock: ethers.parseEther("100").toString(),
    minRewardsTime: BigInt(15).toString(),
  }

  const erc1155Config : PoolConfig = {
    stakingToken: await erc1155.getAddress(),
    rewardsToken: await erc20.getAddress(),
    stakingTokenType: TokenType.IERC1155,
    rewardsPerBlock: ethers.parseEther("100").toString(),
    minRewardsTime: BigInt(15).toString(),
  }

  return [ erc721Config, erc20Config, erc1155Config ];
};