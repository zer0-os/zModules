// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IStakingBase
 * @notice Interface for the base staking contract
 */
interface IStakingBase {
    /**
     * @dev Throw when the lock period has not passed
     */
    error TimeLockNotPassed();

    /**
     * @dev Throw when there are no rewards remaining in the pool
     * to give to stakers
     */
    error NoRewardsLeftInContract();

	/**
     * @dev Throw when passing zero values to set a state var
     */
    error InitializedWithZero();

    /**
     * @dev Emitted when the contract owner withdraws leftover rewards
     * @param owner The address of the contract owner
     * @param amount The amount of rewards withdrawn
     */
    event RewardLeftoverWithdrawal(address indexed owner, uint256 indexed amount);

    /**
     * @notice Emit when a user claims rewards
     * @dev Because all contracts reward in ERC20 this can be shared
     * @param rewards The amount of rewards the user received
     * @param rewardsToken The address of the rewards token contract
     */
    event Claimed(uint256 indexed rewards, address indexed rewardsToken);

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

    function claim() external;

    function getRemainingLockTime() external returns (uint256);

    function getPendingRewards() external view returns (uint256);

    function getContractRewardsBalance() external view returns (uint256);

    function withdrawLeftoverRewards() external;
}
