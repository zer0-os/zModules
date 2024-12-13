// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IStakingBase
 * @notice Interface for the base staking contract
 */
interface IStakingBase {
    /**
     * @notice Struct to track an individual staker's data
     *
     * @param rewardsMultiplier The multiplier for rewards
     * @param lockDuration The duration of the lock
     * @param unlockedTimestamp The timestamp when the stake unlocks
     * @param amountStaked The amount of tokens staked
     * @param amountStakedLocked The amount of tokens locked
     * @param owedRewards The amount of rewards owed
     * @param owedRewardsLocked The amount of rewards locked
     * @param lastTimestamp The timestamp of the last action
     * @param lastTimestampLocked The timestamp of the last locked action
     */
    struct Staker {
        uint256 rewardsMultiplier;
        uint256 lockDuration;
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
     * @param stakingToken The address of the token being staked
     * @param contractOwner The address of the contract owner
     * @param rewardsToken The address of the token being rewarded
     * @param rewardsPerPeriod The amount of rewards per period
     * @param periodLength The length of each period
     * @param minimumLockTime The minimum amount of time a user must lock
     * @param minimumRewardsMultiplier The minimum multiplier for rewards
     * @param maximumRewardsMultiplier The maximum multiplier for rewards
     */
    struct Config {
        address stakingToken;
        address contractOwner;
        IERC20 rewardsToken;
        address stakeRepToken;
        uint256 rewardsPerPeriod;
        uint256 periodLength;
        uint256 minimumLockTime;
        uint256 minimumRewardsMultiplier;
        uint256 maximumRewardsMultiplier;
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
     * @param rewardsToken The address of the rewards token contract
     */
    event Claimed(
        address indexed claimer,
        uint256 indexed rewards,
        address indexed rewardsToken
    );

    /**
     * @notice Emit when the multiplier is set
     * @param owner The address of the contract owner
     * @param multiplier The new multiplier value
     */
    event MultiplierSet(
        address indexed owner,
        uint256 indexed multiplier
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
     * @notice Emit incoming stake is not valid
     */
    error InvalidStake();

    /**
     * @notice Revert when the user tries to stake or unstake 0 tokens
     */
    error ZeroValue();

    /**
     * @notice Throw when the lock period has not passed
     */
    error TimeLockNotPassed();

    /**
     * @notice Throw when trying to claim within an invalid period
     * @dev Used to protect against reentrancy
     */
    error CannotClaim();

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

    function withdrawLeftoverRewards() external;
    
    function setRewardsPerPeriod(uint256 _rewardsPerPeriod) external;

    function setPeriodLength(uint256 _periodLength) external;

    function setMinimumLockTime(uint256 _minimumLockTime) external;

    function setMinimumRewardsMultiplier(uint256 _minimumRewardsMultiplier) external;

    function setMaximumRewardsMultiplier(uint256 _maximumRewardsMultiplier) external;

    function getContractRewardsBalance() external view returns (uint256);

    function getStakingToken() external view returns(address);

    function getRewardsToken() external view returns(IERC20);

    function getRewardsPerPeriod() external view returns(uint256);

    function getPeriodLength() external view returns(uint256);

    function getMinimumLockTime() external view returns(uint256);

    function getMinimumRewardsMultiplier() external view returns(uint256);

    function getMaximumRewardsMultiplier() external view returns(uint256);
}
