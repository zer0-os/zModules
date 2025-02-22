// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import { IStakingBase } from "../IStakingBase.sol";


/**
 * @title IStakingERC20
 * @notice Interface for the ERC20 staking contract
 */
interface IStakingERC20 is IStakingBase{
    /**
     * @notice Emit when a user stakes a token
     * @param staker The address of the account which staked
     * @param amount The amount of the staked token passed as an argument to the `stake()`
     * @param lockDuration The duration for which the stake is locked
     */
    event Staked(
        address indexed staker,
        uint256 indexed amount,
        uint256 indexed lockDuration
    );

    /**
     * @notice Emit when a user unstakes
     * @param staker The address of the account which unstaked
     * @param amount The amount of the staked token
     */
    event Unstaked(
        address indexed staker,
        uint256 indexed amount
    );

    /**
     * @notice Emit when a users exits
     * @param staker The address of the user exiting
     * @param amount The amount withdrawn
     * @param locked If the amount was locked
     */
    event Exited(
        address indexed staker,
        uint256 indexed amount,
        bool indexed locked
    );

    /**
     * @notice Revert when the user tries to unstake more than the initial stake amount
     */
    error UnstakeMoreThanStake();

    /**
     * @notice Revert when the user is staking an amount inequal to the amount given
     */
    error InsufficientValue();

    /**
     * @notice Revert when the user is sending gas token with ERC20 stake
     */
    error NonZeroMsgValue();

    function stakeWithLock(uint256 amount, uint256 lockDuration) external payable;

    function stakeWithoutLock(uint256 amount) external payable;

    function claim() external;

    function unstakeUnlocked(uint256 amount) external;

    function unstakeLocked(uint256 amount) external;

    function exit(bool locked) external;

    function getRemainingLockTime() external view returns (uint256);

    function getPendingRewards() external view returns (uint256);
}
