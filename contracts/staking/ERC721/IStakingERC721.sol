// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";


/**
 * @title IStakingERC721
 * @notice Interface for the StakingERC721 contract
 */
interface IStakingERC721 is IERC721Receiver {
	/**
     * @notice Emit when a user stakes a token
     * @param tokenId The token ID of the staked token
     * @param stakingToken The address of the staking token contract
     */
    event Staked(uint256 indexed tokenId, address indexed stakingToken);

    /**
     * @notice Emit when a user unstakes
     * @param tokenId The token ID of the staked token
     * @param stakingToken The address of the staking token contract
     */
    event Unstaked(uint256 indexed tokenId, address indexed stakingToken);

    function stake(uint256[] calldata tokenIds, string[] calldata tokenURIs) external;

    function unstake(uint256[] memory tokenIds, bool exit) external;
}
