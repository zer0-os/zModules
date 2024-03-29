import { ethers } from "hardhat";

export const dayInSeconds = 86400n;

export const DEFAULT_STAKE_ERC721 = 1;
export const DEFAULT_STAKE_ERC20 = ethers.parseEther("1");

// % yield is ratio of pool weight and period length
export const DEFAULT_POOL_WEIGHT = 4n;
export const DEFAULT_PERIOD_LENGTH = dayInSeconds*3n;
export const DEFAULT_LOCK_TIME = DEFAULT_PERIOD_LENGTH * 2n;



// w=3 and p=5 == 12
// w=4 and p=5 == 16

