import { ethers } from "ethers";

export const DAY_IN_SECONDS = 86400n;

export const DEFAULT_REWARDS_PER_PERIOD_ERC20 = 50n;
export const DEFAULT_PERIOD_LENGTH_ERC20 = 365n * DAY_IN_SECONDS;

export const DEFAULT_REWARDS_PER_PERIOD_ERC721 = ethers.parseEther("1000000");
export const DEFAULT_PERIOD_LENGTH_ERC721 = 365n * DAY_IN_SECONDS;

export const DEFAULT_LOCK = 365n * DAY_IN_SECONDS;
export const DEFAULT_MINIMUM_LOCK = 30n * DAY_IN_SECONDS;

// 1.0 and 10.0, respectively
export const DEFAULT_MINIMUM_RM = 100n;
export const DEFAULT_MAXIMUM_RM = 1000n;

export const PRECISION_DIVISOR = 1000n;
export const LOCKED_PRECISION_DIVISOR = 100000n;

export const STAKING721_TOKEN_NAME_DEFAULT = "Staking721";
export const STAKING721_TOKEN_SYMBOL_DEFAULT = "STK721";
export const STAKING721_BASE_URI_DEFAULT = "https://staking721.com/";

export const MATCH_GAME_FEE_PERCENTAGE_DEFAULT = 1000n; // 10%

// Staking Events
export const STAKED_EVENT = "Staked";
export const CLAIMED_EVENT = "Claimed";
export const UNSTAKED_EVENT = "Unstaked";
export const WITHDRAW_EVENT = "LeftoverRewardsWithdrawn";
export const BASE_URI_UPDATED_EVENT  = "BaseURIUpdated";

// Init balance is 10,000 token
export const INIT_BALANCE = ethers.parseEther("10000");

// Default stake = 1000 token
export const DEFAULT_STAKED_AMOUNT = INIT_BALANCE / 10n;

// Migration Claim Events
export const MERKLE_ROOT_SET_EVENT = "MerkleRootSet";
export const REWARDS_VAULT_SET_EVENT = "RewardsVaultSet";


