// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";


/**
 * @title IStakingBase
 * @notice Interface for the base staking contract
 */
interface IStakingERC721 is IERC721, IERC721Receiver {
    // /**
    //  * @dev Throw when the lock period has not passed
    //  */
    // error TimeLockNotPassed();

    // /**
    //  * @dev Throw when there are no rewards remaining in the pool
    //  * to give to stakers
    //  */
    // error NoRewardsLeftInContract();

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
    /**
     * @dev Emitted when the base URI is updated
     * @param baseURI The new base URI
     */
    event BaseURIUpdated(string baseURI);

    function stake(uint256[] calldata tokenIds, string[] calldata tokenURIs) external;

    // function claim() external;

    function unstake(uint256[] memory tokenIds, bool exit) external;

    // function setBaseURI(string memory baseUri) external;

    // function setTokenURI(uint256 tokenId, string memory tokenUri) external;

    // function withdrawLeftoverRewards() external;

    // function getContractRewardsBalance() external view returns (uint256);

    // function getPendingRewards() external view returns (uint256);

    // function getRemainingLockTime() external view returns (uint256);

    // function totalSupply() external view returns (uint256);

    // function supportsInterface(bytes4 interfaceId) external view returns (bool);

    // function getInterfaceId() external pure returns (bytes4);
}
