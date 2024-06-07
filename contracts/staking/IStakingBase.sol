// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;


/**
 * @title IStakingBase
 * @notice Interface for the base staking contract
 */
interface IStakingBase {
    /**
     * @notice Struct to track a set of data for each staker
     * @param unlockTimestamp The timestamp at which the stake can be unstaked
     * @param owedRewards The amount of rewards snapshotted and not yet paid to the user
     * @param lastUpdatedTimestamp The timestamp at which the staker last interacted with the contract
     * @param amountStaked The amount of token(s) staked by the user
     */
    struct Staker {
        uint256 unlockTimestamp;
        uint256 owedRewards;
        uint256 lastUpdatedTimestamp;
        uint256 amountStaked;
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
     * @notice Throw when the lock period has not passed
     */
    error TimeLockNotPassed();

    /**
     * @notice Throw when there are no rewards remaining in the pool
     * to give to stakers
     */
    error NoRewardsLeftInContract();

    /**
     * @notice Throw when passing zero values to set a state var
     */
    error InitializedWithZero();

    /**
     * @notice Revert when the user tries to stake 0 tokens
     */
    error ZeroStake();
    /**
     * @notice Revert when the user tries to unstake 0 tokens
     */
    error ZeroUnstake();

    function claim() external;

    function getRemainingLockTime() external returns (uint256);

    function withdrawLeftoverRewards() external;

    function getPendingRewards() external view returns (uint256);

    function getContractRewardsBalance() external view returns (uint256);
}
