// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;


/**
 * @title IStakingERC20
 * @notice Interface for the ERC20 staking contract
 */
interface IStakingERC20 {
    /**
     * @notice Emit when a user stakes a token
     * @param staker The address of the account which staked
     * @param amount The amount of the staked token
     * @param stakingToken The address of the staking token contract
     */
    event Staked(
        address indexed staker,
        uint256 indexed amount,
        address indexed stakingToken
    );

    /**
     * @notice Emit when a user unstakes
     * @param amount The amount of the staked token
     * @param stakingToken The address of the staking token contract
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

    function stake(uint256 amount) external;

    function unstake(uint256 amount, bool exit) external;
}
