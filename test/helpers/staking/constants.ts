import { ethers } from "ethers";

export const DAY_IN_SECONDS = 86400n;

export const DEFAULT_STAKE_ERC721 = 1;
export const DEFAULT_STAKE_ERC20 = 1;

export const DEFAULT_REWARDS_PER_PERIOD = 10n;
export const DEFAULT_PERIOD_LENGTH = 17n;
export const DEFAULT_LOCK_TIME = 189n; // timestamp values

// Events
export const STAKED_EVENT = "Staked";
export const CLAIMED_EVENT = "Claimed";
export const UNSTAKED_EVENT = "Unstaked";
export const WITHDRAW_EVENT = "LeftoverRewardsWithdrawn";

// TODO test this event
export const BASE_URI_UPDATED_EVENT  = "BaseURIUpdated";

export const INIT_BALANCE = ethers.parseEther("1000000000000");
export const DEFAULT_STAKED_AMOUNT = INIT_BALANCE / 10000n;
