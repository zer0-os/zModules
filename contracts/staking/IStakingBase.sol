// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


/**
 * @title IStakingBase
 * @notice Interface for the base staking contract
 */
interface IStakingBase {

    struct NFTStake {
        uint256 tokenId;
        bool locked;
    }

    /**
     * @notice Struct to track an individual staker's data
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
     * @notice Emit when the amount to adjust a lock after restake is changed
     * @param owner The setter
     * @param lockAdjustment The new lock adjustment value
     */
    event LockAdjustmentSet(
        address indexed owner,
        uint256 indexed lockAdjustment
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
     * @notice Throw when passing zero values to set a state var
     */
    error InitializedWithZero();

    function withdrawLeftoverRewards() external;

    function getContractRewardsBalance() external view returns (uint256);

    function getStakeValue(uint256 amount, uint256 lockDuration) external view returns(uint256);
}
