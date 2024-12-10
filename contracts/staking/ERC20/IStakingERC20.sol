// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


/**
 * @title IStakingERC20
 * @notice Interface for the ERC20 staking contract
 */
interface IStakingERC20 {
    /**
address of the staking token contract
     */
    event Staked(
        address indexed staker,
        uint256 indexed amount,
        uint256 indexed lockDuration,
        address stakingToken
    );

    /**
     * @notice Emit when a user unstakes
    //  * @param amount The amount of the staked token
    //  * @param stakingToken The address of the staking token contract
     */
    event Unstaked(
        address indexed staker,
        uint256 indexed amount,
        address indexed stakingToken
    );

    /**
     * @notice Revert when the user tries to unstake more than the initial stake amount
     */
    error UnstakeMoreThanStake();

    function stakeWithLock(uint256 amount, uint256 lockDuration) external;

    function stakeWithoutLock(uint256 amount) external;

    function claim() external;

    function unstake(uint256 amount) external;

    function unstakeLocked(uint256 amount, bool exit) external;

    function getRemainingLockTime() external view returns (uint256);

    function getPendingRewards() external view returns (uint256);
}
