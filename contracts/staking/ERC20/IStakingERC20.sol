// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


/**
 * @title IStakingERC20
 * @notice Interface for the ERC20 staking contract
 */
interface IStakingERC20 {
	error UnstakeMoreThanStake();
    /**
     * @notice Emit when a user stakes a token
     * @param amount The amount of the staked token
     * @param stakingToken The address of the staking token contract
     */
    event Staked(uint256 indexed amount, address indexed stakingToken);
    /**
     * @notice Emit when a user unstakes
     * @param amount The amount of the staked token
     * @param stakingToken The address of the staking token contract
     */
    event Unstaked(uint256 indexed amount, address indexed stakingToken);

    function stake(uint256 amount) external;

    function unstake(uint256 amount, bool exit) external;
}
