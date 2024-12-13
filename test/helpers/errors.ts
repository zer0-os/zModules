// ERC721
export const NONEXISTENT_TOKEN_ERR = "ERC721NonexistentToken";
export const INCORRECT_OWNER_ERR = "ERC721IncorrectOwner";
export const INSUFFICIENT_APPROVAL_721_ERR = "ERC721InsufficientApproval";

// ERC20
export const INSUFFICIENT_ALLOWANCE_ERR = "ERC20InsufficientAllowance";
export const INSUFFICIENT_BALANCE_ERR = "ERC20InsufficientBalance";

// OwnableOperable
export const NOT_AUTHORIZED_ERR = "NotAuthorized";
export const ZERO_ADDRESS_ERR = "ZeroAddressPassed";
export const OWNABLE_INVALID_OWNER_ERR = "OwnableInvalidOwner";
export const OWNABLE_UNAUTHORIZED_ERR = "OwnableUnauthorizedAccount";
export const OPERATOR_ALREADY_ASSIGNED_ERR = "OperatorAlreadyAssigned";
export const OPERATOR_NOT_ASSIGNED_ERR = "OperatorNotAssigned";

// StakingERC20
export const UNEQUAL_UNSTAKE_ERR = "UnstakeMoreThanStake";
export const ZERO_REWARDS_ERR = "ZeroRewards";

// StakingERC721
export const TIME_LOCK_NOT_PASSED_ERR = "TimeLockNotPassed";
export const INVALID_OWNER_ERR = "InvalidOwner";
export const NON_TRANSFERRABLE_ERR = "NonTransferrableToken";
export const ZERO_INIT_ERR = "InitializedWithZero";
export const INVALID_UNSTAKE_ERR = "InvalidUnstake";

// StakingBase
export const INSUFFICIENT_CONTRACT_BALANCE_ERR = "InsufficientContractBalance";
export const LOCK_TOO_SHORT_ERR = "LockTimeTooShort";
export const ZERO_VALUE_ERR = "ZeroValue";

// eslint-disable-next-line max-len
export const FUNCTION_SELECTOR_ERR = "Transaction reverted: function selector was not recognized and there's no fallback function";
export const FAILED_INNER_CALL_ERR = "FailedInnerCall";

// Escrow
export const ZERO_AMOUNT_ERR = "ZeroAmountPassed";
export const NOT_A_CONTRACT_ERR= "AddressIsNotAContract";
export const INSUFFICIENT_FUNDS_ERR = "InsufficientFunds";

// Match
export const NO_PLAYERS_ERR = "NoPlayersInMatch";
export const MATCH_STARTED_ERR = "MatchAlreadyStarted";
export const INVALID_MATCH_ERR = "InvalidMatchOrMatchData";
export const INVALID_PAYOUTS_ERR = "InvalidPayouts";
export const ARRAY_MISMATCH_ERR = "ArrayLengthMismatch";
export const ZERO_MATCH_FEE_ERR = "ZeroMatchFee";
