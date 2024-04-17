// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract AStakingBase {
    /**
     * @dev The staking token for this pool
     */
    address public stakingToken;

    /**
     * @dev The rewards token for this pool
     */
    IERC20 public rewardsToken;

    /**
     * @dev The rewards of the pool per period length
     */
    uint256 public rewardsPerPeriod;

    /**
     * @dev The length of a time period
     */
    uint256 public periodLength;

    /**
     * @dev The amount of time required to pass to be able to claim or unstake
     */
    uint256 public timeLockPeriod;

    // TODO evaluate where these are all used
    /**
     * @dev Throw when caller is not the sNFT owner
     */
    error InvalidOwner();

    /**
     * @dev Throw when caller is unable to stake
     */
    error InvalidStake();

    /**
     * @dev Throw when caller is unable to claim rewards
     */
    error InvalidClaim();

    /**
     * @dev Throw when caller is unable to unstake
     */
    error InvalidUnstake();

    /**
     * @dev Throw when the lock period has not passed
     */
    error TimeLockNotPassed();

    /**
     * @dev Throw when there are no rewards to transfer
     */
    error NoRewards();

    /**
     * @notice Calculate rewards for a staker
     * @dev Returns 0 if time lock period is not passed
     * @param timePassed Time passed since last stake or claim, in seconds
     * @param stakeAmount Amount of staking token staked
     */
    function _calculateRewards(
        uint256 timePassed,
        uint256 stakeAmount
    ) internal view returns (uint256) {
        return rewardsPerPeriod * stakeAmount * (timePassed / periodLength);
    }
}
