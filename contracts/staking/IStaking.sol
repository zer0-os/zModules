// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Interface for shared events among staking contracts
interface IStaking {
    // Staked event for ERC721, ERC20, and ERC1155 tokens
    event Staked(
        uint256 indexed tokenId,
        uint256 indexed amount,
        uint256 indexed index,
        address stakingToken
    );
    // TODO stakingTokenType, try without until 1155 and see what's necessary
    // might need for pool validation on creation
    // maybe add address of token that was staked, e.g. stakingToken contract

    // Fire when a user calls to `claim` or `claimBulk`
    // We don't need an individuak `ClaimBulk` event here because
    // we don't need an array of values like `tokenids` or `amounts`
    /**
     * @notice Emit when a user claims rewards
     * @dev We don't need an individuak `ClaimBulk` event here because
     * we don't have an array of values like `tokenids` or `amounts`
     * @param amount The amount of the token that was claimed
     * @param stakingToken The address of the staking token
     */
    event Claimed(
        uint256 indexed amount,
        address stakingToken
    );

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
}