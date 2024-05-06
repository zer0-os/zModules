// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";


/**
 * @title IStakingERC721
 * @notice Interface for the StakingERC721 contract
 */
interface IStakingERC721 is IERC721Receiver {
    /**
     * @dev Emitted when the base URI is updated
     * @param baseURI The new base URI
     */
    event BaseURIUpdated(string baseURI);

    /**
     * @notice Emit when a user stakes a token
     * @param staker The address of the user staking
     * @param tokenId The token ID of the staked token
     * @param stakingToken The address of the staking token contract
     */
    event Staked(
        address indexed staker,
        uint256 indexed tokenId,
        address indexed stakingToken
    );

    /**
     * @notice Emit when a user unstakes
     * @param staker The address of the user unstaking
     * @param tokenId The token ID of the staked token
     * @param stakingToken The address of the staking token contract
     */
    event Unstaked(
        address indexed staker,
        uint256 indexed tokenId,
        address indexed stakingToken
    );

    /**
     * @dev Throw when caller is not the sNFT owner
     */
    error InvalidOwner();

    /**
     * @dev Throw when trying to transfer the representative sNFT
     */
    error NonTransferrableToken();

    function stake(
        uint256[] calldata tokenIds,
        string[] calldata tokenURIs
    ) external;

    function unstake(uint256[] memory tokenIds, bool exit) external;

    function setBaseURI(string memory baseUri) external;

    function setTokenURI(uint256 tokenId, string memory tokenUri) external;

    function totalSupply() external view returns (uint256);

    function getInterfaceId() external pure returns (bytes4);
}
