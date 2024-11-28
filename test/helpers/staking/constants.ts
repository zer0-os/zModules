import { ethers } from "ethers";

export const DAY_IN_SECONDS = 86400n;

// 1e16
export const DEFAULT_MULTIPLIER = 10000000000000000n;

export const DEFAULT_REWARDS_PER_PERIOD_ERC20 = 1n;
export const DEFAULT_REWARDS_PER_PERIOD_ERC721 = ethers.parseEther("1500");
export const DEFAULT_PERIOD_LENGTH = DAY_IN_SECONDS;
export const DEFAULT_LOCK = 365n * DAY_IN_SECONDS;
export const DEFAULT_LOCK_ADJUSTMENT = 30n * DAY_IN_SECONDS;

// Used in rewards calculations
export const PRECISION_DIVISOR = 1000n;
export const LOCKED_PRECISION_DIVISOR = 100000n;

// Events
export const STAKED_EVENT = "Staked";
export const CLAIMED_EVENT = "Claimed";
export const UNSTAKED_EVENT = "Unstaked";
export const WITHDRAW_EVENT = "LeftoverRewardsWithdrawn";

// TODO test this event
export const BASE_URI_UPDATED_EVENT  = "BaseURIUpdated";

// Init balance is 10,000 token
export const INIT_BALANCE = ethers.parseEther("10000");

// Default stake = 1000 token
export const DEFAULT_STAKED_AMOUNT = INIT_BALANCE / 10n;
