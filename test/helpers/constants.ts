import { ethers } from "ethers";

export const DAY_IN_SECONDS = 86400n;

export const DEFAULT_STAKE_ERC721 = 1;
export const DEFAULT_STAKE_ERC20 = 1;

// export const DEFAULT_REWARDS_PER_PERIOD = ethers.parseEther("6");
export const DEFAULT_REWARDS_PER_PERIOD = 1n // * 10^18?
export const DEFAULT_PERIOD_LENGTH = 1500n * DAY_IN_SECONDS;
export const DEFAULT_LOCK_TIME = 0n * DAY_IN_SECONDS;

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

// User has 25k, default stake is 1k
export const INIT_BALANCE = ethers.parseEther("25000");
export const DEFAULT_STAKED_AMOUNT = ethers.parseEther("1000");
