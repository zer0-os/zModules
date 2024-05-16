// ERC721
export const NONEXISTENT_TOKEN_ERR = "ERC721NonexistentToken";
export const INCORRECT_OWNER_TRANSFER_ERR = "ERC721IncorrectOwner";
export const ONLY_NFT_OWNER_ERR = "ERC721: caller is not token owner or approved";
export const INSUFFICIENT_APPROVAL_721_ERR = "ERC721InsufficientApproval";

// ERC20
export const INSUFFICIENT_ALLOWANCE_ERR = "ERC20InsufficientAllowance";
export const INSUFFICIENT_BALANCE_ERR = "ERC20InsufficientBalance";

// Ownable /OwnableOperatable
export const ONLY_OWNER_ERR = "Ownable: caller is not the owner";
export const NOT_AUTHORIZED_ERR = "NotAuthorized";

// StakingERC20
export const TIME_LOCK_DURATION_ERR = "Staking20: Cannot claim or unstake before time lock period";
export const POOL_NOT_EXIST_ERR = "Staking pool does not exist";
export const INVALID_POOL_ERR = "Staking token must not be zero";
export const ONLY_SNFT_OWNER_ERR = "Caller is not the owner of the representative stake token";
export const ONLY_ADMIN_ERR = "Caller is not the admin";
export const ZERO_STAKE_ERR = "ZeroStake";
export const UNEQUAL_UNSTAKE_ERR = "UnstakeMoreThanStake";

// StakingERC721
export const TIME_LOCK_NOT_PASSED_ERR = "TimeLockNotPassed";
export const INVALID_OWNER_ERR = "InvalidOwner";
export const NO_REWARDS_ERR = "NoRewardsLeftInContract";
export const NON_TRANSFERRABLE_ERR = "NonTransferrableToken";
export const ZERO_INIT_ERR = "InitializedWithZero";
export const NOT_OWNER_ERR = "Ownable: caller is not the owner";

// eslint-disable-next-line max-len
export const FUNCTION_SELECTOR_ERR = "Transaction reverted: function selector was not recognized and there's no fallback function";
export const FAILED_INNER_CALL_ERR = "FailedInnerCall";

// Escrow
export const ZERO_AMOUNT_ERR = "ZeroAmountPassed";
export const NOT_A_CONTRACT_ERR= "AddressIsNotAContract";
export const INSUFFICIENT_FUNDS_ERR = "InsufficientFunds";

// OwnableOperatable
export const ZERO_ADDRESS_ERR = "ZeroAddressPassed";
export const OWNABLE_INVALID_OWNER_ERR = "OwnableInvalidOwner";
export const OWNABLE_UNAUTHORIZED_ERR = "OwnableUnauthorizedAccount";

// Match
export const NO_PLAYERS_ERR = "NoPlayersInMatch";
export const MATCH_STARTED_ERR = "MatchAlreadyStarted";
export const INVALID_MATCH_ERR = "InvalidMatchOrPayouts";
export const ARRAY_MISMATCH_ERR = "ArrayLengthMismatch";