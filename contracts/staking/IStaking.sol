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
        uint256 indexed rewards,
        IERC20 indexed rewardsToken
    );

    /**
     * @notice Emit when a user unstakes
     * @param tokenId The token ID of the staked token
     * @param amount The amount of the token that was unstaked
     * @param index The index of the staked asset
     * @param stakingToken The address of the staking token
     */
    event Unstaked(
        uint256 indexed tokenId,
        uint256 indexed amount,
        uint256 indexed index,
        address stakingToken
    );

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
}