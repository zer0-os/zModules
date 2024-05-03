// ERC721
export const INVALID_TOKEN_ID_ERR = "ERC721: invalid token ID";
export const INCORRECT_OWNER_TRANSFER_ERR = "ERC721: transfer from incorrect owner";
export const ONLY_NFT_OWNER_ERR = "ERC721: caller is not token owner or approved";

// ERC20
export const INSUFFICIENT_ALLOWANCE_ERR = "ERC20: insufficient allowance";
export const INSUFFICIENT_BALANCE_ERR = "ERC20: transfer amount exceeds balance";

// Ownable
export const ONLY_OWNER_ERR = "Ownable: caller is not the owner";

// StakingERC20
export const TIME_LOCK_DURATION_ERR = "Staking20: Cannot claim or unstake before time lock period";
export const POOL_NOT_EXIST_ERR = "Staking pool does not exist";
export const INVALID_POOL_ERR = "Staking token must not be zero";
export const ONLY_SNFT_OWNER_ERR = "Caller is not the owner of the representative stake token";
export const ONLY_ADMIN_ERR = "Caller is not the admin";
export const ZERO_STAKE_ERR = "ZeroStake";
export const UNEQUAL_UNSTAKE_ERR = "UnstakeMoreThanStake"

// StakingERC721
export const TIME_LOCK_NOT_PASSED_ERR = "TimeLockNotPassed";
export const INVALID_OWNER_ERR = "InvalidOwner";
export const NO_REWARDS_ERR = "NoRewardsLeftInContract";
export const NON_TRANSFERRABLE_ERR = "NonTransferrableToken";
export const ZERO_INIT_ERR = "InitializedWithZero";

export const NOT_OWNER_ERR = "Ownable: caller is not the owner";

// eslint-disable-next-line max-len
export const FUNCTION_SELECTOR_ERR = "Transaction reverted: function selector was not recognized and there's no fallback function";
