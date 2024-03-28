import { ethers } from "hardhat";

export const dayInSeconds = 86400n;

export const DEFAULT_STAKE_ERC721 = 1;
export const DEFAULT_STAKE_ERC20 = ethers.parseEther("1000");

export const DEFAULT_POOL_WEIGHT = ethers.parseEther("5");
export const DEFAULT_PERIOD_LENGTH = 5n;
export const DEFAULT_LOCK_TIME = DEFAULT_PERIOD_LENGTH * 2n;
