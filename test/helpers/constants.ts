import { ethers } from "ethers";

export const dayInSeconds = 86400n;

export const DEFAULT_STAKE_ERC721 = 1;
export const DEFAULT_STAKE_ERC20 = 1;

export const DEFAULT_REWARDS_PER_PERIOD = 6n;
export const DEFAULT_PERIOD_LENGTH = 17n;
export const DEFAULT_LOCK_TIME = 189n;

export const STAKING721_TOKEN_NAME_DEFAULT = "Staking721";
export const STAKING721_TOKEN_SYMBOL_DEFAULT = "STK721";
export const STAKING721_BASE_URI_DEFAULT = "https://staking721.com/";

export const MATCH_GAME_FEE_PERCENTAGE_DEFAULT = 1000n; // 10%

// Events
export const STAKED_EVENT = "Staked";
export const CLAIMED_EVENT = "Claimed";
export const UNSTAKED_EVENT = "Unstaked";
export const WITHDRAW_EVENT = "LeftoverRewardsWithdrawn";

export const BASE_URI_UPDATED_EVENT  = "BaseURIUpdated";

export const INIT_BALANCE = ethers.parseEther("1000000000000");
export const DEFAULT_STAKED_AMOUNT = INIT_BALANCE / 10000n;
