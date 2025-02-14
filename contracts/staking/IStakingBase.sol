// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


/**
 * @title IStakingBase
 * @notice Interface for the base staking contract
 */
interface IStakingBase {
    /**
     * @notice Struct to track an individual staker's data
     *
     * @param unlockedTimestamp The timestamp when the stake unlocks
     * @param amountStaked The amount of tokens staked
     * @param amountStakedLocked The amount of tokens locked
     * @param owedRewards The amount of rewards owed
     * @param owedRewardsLocked The amount of rewards locked
     * @param lastTimestamp The timestamp of the last action
     * @param lastTimestampLocked The timestamp of the last locked action
     */
    struct Staker {
        uint256 unlockedTimestamp;
        uint256 amountStaked;
        uint256 amountStakedLocked;
        uint256 owedRewards;
        uint256 owedRewardsLocked;
        uint256 lastTimestamp;
        uint256 lastTimestampLocked;
    }
    /**
     * @notice Struct to hold all required config variables
     * 
     * @param timestamp When the config was set
     * @param rewardsPerPeriod The amount of rewards given per period
     * @param periodLength The length of each period
     * @param minimumLockTime The minimum amount of time a user must lock
     * @param minimumRewardsMultiplier The minimum multiplier for rewards
     * @param maximumRewardsMultiplier The maximum multiplier for rewards
     * @param canExit Flag to indicate if `exit` is allowed or not
     */
    struct Config {
        uint256 timestamp;
        uint256 rewardsPerPeriod;
        uint256 periodLength;
        uint256 minimumLockTime;
        uint256 minimumRewardsMultiplier;
        uint256 maximumRewardsMultiplier;
        bool canExit;
    }

    /**
     * @notice Emitted when the contract owner withdraws leftover rewards
     * @param owner The address of the contract owner
     * @param amount The amount of rewards withdrawn
     */
    event LeftoverRewardsWithdrawn(
        address indexed owner,
        uint256 indexed amount
    );

    /**
     * @notice Emit when a user claims rewards
     * @dev Because all contracts reward in ERC20 this can be shared
     * @param claimer The address of the user claiming rewards
     * @param rewards The amount of rewards the user received
     */
    event Claimed(
        address indexed claimer,
        uint256 indexed rewards
    );

    /**
     * @notice Emit when a new contract owner is set
     * @param owner The new owner
     */
    event OwnerSet(
        address indexed owner
    );

    /**
     * @notice Emit when `reqwardsPerPeriod` is set
     * @param owner The address of the contract owner
     * @param rewardsPerPeriod The new rewards per period value
     */
    event RewardsPerPeriodSet(
        address indexed owner,
        uint256 indexed rewardsPerPeriod
    );

    /**
     * @notice Emit when the period length is set
     * @param owner The address of the contract owner
     * @param periodLength The new period length value
     */
    event PeriodLengthSet(
        address indexed owner,
        uint256 indexed periodLength
    );

    /**
     * @notice Emit when the minimum lock time is set
     * @param owner The address of the contract owner
     * @param minimumLockTime The new minimum lock time
     */
    event MinimumLockTimeSet(
        address indexed owner,
        uint256 indexed minimumLockTime
    );

    /**
     * @notice Emit when the minimum rewards multiplier is set
     * @param owner The address of the contract owner
     * @param minimumRewardsMultiplier The new minimum rewards multiplier
     */
    event MinimumRewardsMultiplierSet(
        address indexed owner,
        uint256 indexed minimumRewardsMultiplier
    );

    /**
     * @notice Emit when the maximum rewards multiplier is set
     * @param owner The address of the contract owner
     * @param maximumRewardsMultiplier The new maximum rewards multiplier
     */
    event MaximumRewardsMultiplierSet(
        address indexed owner,
        uint256 indexed maximumRewardsMultiplier
    );

    /**
     * @notice Emit when the `canExit` flag is set
     * @param exit The new exit status
     */
    event ExitSet(
        bool exit
    );

    /**
     * @notice Emit when the config is set
     * @param config The incoming config
     */
    event ConfigSet(
        Config indexed config
    );

    /**
     * @notice Revert when the user tries to stake or unstake 0 tokens
     */
    error ZeroValue();

    /**
     * @notice Throw when the lock period has not passed
     */
    error TimeLockNotPassed();

    /**
     * @notice Throw when trying to claim but user has no rewards
     */
    error ZeroRewards();

    /**
     * @notice Throw when the contract requires additional funding to
     * be able to match owed rewards
     */
    error InsufficientContractBalance();

    /**
     * @notice Throw when a staker tries to lock for less than
     * the minimum lock time
     */
    error LockTimeTooShort();

    /**
     * @notice Throw when passing zero values to set a state var
     */
    error InitializedWithZero();

    /**
     * @notice Throw when passing a multiplier to set that is not within the bounds
     */
    error InvalidMultiplierPassed();

    /**
     * @notice Throw when the transfer of gas token fails
     */
    error GasTokenTransferFailed();

    /**
     * @notice Throw when a call to exit is disallowed
     */
    error CannotExit();

    receive() external payable;

    function withdrawLeftoverRewards() external;

    function setConfig(Config memory _config) external;

    function getContractRewardsBalance() external view returns (uint256);

    function getStakingToken() external view returns(address);

    function getRewardsToken() external view returns(address);

    function getStakeRepToken() external view returns (address);

    function getRewardsPerPeriod() external view returns(uint256);

    function getStakeRewards(uint256 amount, uint256 timeDuration, bool locked) external view returns (uint256);

    function getPeriodLength() external view returns(uint256);

    function getMinimumLockTime() external view returns(uint256);

    function getMinimumRewardsMultiplier() external view returns(uint256);

    function getMaximumRewardsMultiplier() external view returns(uint256);

    function canExit() external view returns(bool);
}
