// SPDX-License-Identifier: MIT
// eslint-disable immutable-vars-naming
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title AStakingBase
 * @notice A set of common elements that comprise any Staking contract
 */
contract StakingBase {
    /**
     * @dev The staking token for this pool
     */
    address public immutable stakingToken;

    /**
     * @dev The rewards token for this pool
     */
    IERC20 public immutable rewardsToken;

    /**
     * @dev The rewards of the pool per period length
     */
    uint256 public immutable rewardsPerPeriod;

    /**
     * @dev The length of a time period
     */
    uint256 public immutable periodLength;

    /**
     * @dev The amount of time required to pass to be able to claim or unstake
     */
    uint256 public immutable timeLockPeriod;

    /**
     * @dev Throw when caller is not the sNFT owner
     */
    error InvalidOwner();

    /**
     * @dev Throw when the lock period has not passed
     */
    error TimeLockNotPassed();

    /**
     * @dev Throw when there are no rewards remaining in the contract
     * to give to stakers
     */
    error NoRewardsLeftInContract();

    /**
     * @dev Throw when passing zero values to set a state var
     */
    error InitializedWithZero();

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _timeLockPeriod
    ) {
        if (
            _stakingToken == address(0)
            || address(_rewardsToken) == address(0)
            || _rewardsPerPeriod == 0
            || _periodLength == 0
        )
            revert InitializedWithZero();

        stakingToken = _stakingToken;
        rewardsToken = _rewardsToken;
        rewardsPerPeriod = _rewardsPerPeriod;
        periodLength = _periodLength;
        timeLockPeriod = _timeLockPeriod;
    }

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
