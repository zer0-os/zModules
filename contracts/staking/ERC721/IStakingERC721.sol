// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


/**
 * @title IStakingERC721
 * @notice Interface for the ERC721 staking contract
 */
interface IStakingERC721 {
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

    function stake(uint256[] calldata tokenIds) external;

    function unstake(uint256[] memory tokenIds, bool exit) external;
}
