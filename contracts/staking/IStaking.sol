// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Interface for shared events among staking contracts of different types
 * @dev Supports ERC721, ERC20, and ERC1155 staking
 */
interface IStaking {
    /**
     * @notice Emit when a user stakes a token
     * @param tokenId The token ID of the staked token
     * @param amount The amount of the token that was staked
     * @param index The index of the staked asset (1155s only)
     * @param stakingToken The address of the staking token
     */
    event Staked(
        uint256 indexed tokenId,
        uint256 indexed amount,
        uint256 indexed index,
        address stakingToken
    );

    /**
     * @notice Emit when a user claims rewards
     * @param rewards The amount of rewards the user received
     * @param rewardsToken The address of the staking token
     */
    event Claimed(
        uint256 rewards,
        IERC20 rewardsToken
    );

    // /**
    //  * @notice Emit when a user claims rewards for multiple tokens
    //  * @param tokenId The token IDs of the staked token
    //  * @param amount The amount of one or multiple staked tokens that was claimed upon
    //  * @param index The index of the staked asset
    //  * @param rewards The amount of rewards the user received
    //  * @param stakingToken The address of the staking token
    //  */
    // event ClaimedBulk(
    //     uint256[] indexed tokenId,
    //     uint256[] indexed amount,
    //     uint256[] indexed index,
    //     uint256 rewards,
    //     address stakingToken
    // );

    /**
     * @notice Emit when a user unstakes
     * @param tokenId The token ID of the staked token
     * @param amount The amount of the token that was unstaked
     * @param index The index of the staked asset
     * @param rewards The amount of rewards the user received
     * @param stakingToken The address of the staking token
     */
    event Unstaked(
        uint256 indexed tokenId,
        uint256 indexed amount,
        uint256 indexed index,
        uint256 rewards,
        address stakingToken
    );

    /**
     * @notice Emit when a user unstakes multiple tokens
     * @param tokenIds The token IDs of the staked tokens
     * @param amounts The amounts of the tokens that were unstaked
     * @param indexes The indexes of the staked assets
     * @param stakingToken The address of the staking token
     */
    event UnstakedBulk(
        uint256[] indexed tokenIds,
        uint256[] indexed amounts,
        uint256[] indexed indexes,
        uint256 rewards,
        address stakingToken
    );

    event RemovedStake(
        uint256 indexed tokenId,
        uint256 indexed amount,
        uint256 indexed index,
        address stakingToken
    );

    event RemoveStakeBulk(
        uint256[] indexed tokenIds,
        uint256[] indexed amounts,
        uint256[] indexed indexes,
        address stakingToken
    );

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
}