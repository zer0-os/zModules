// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";


/**
 * @title IStakingERC721
 * @notice Interface for the ERC721 staking contract
 */
interface IStakingERC721 is IERC721, IERC721Receiver {
    /**
     * @notice Struct to track a set of data for each staker
     * @param unlockTimestamp The timestamp at which the stake can be unstaked
     * @param pendingRewards The amount of rewards that have not been claimed
     * @param lastUpdatedTimestamp The timestamp at which the staker last interacted with the contract
     * @param numStaked The number of tokens staked by the user
     */
    struct Staker {
        uint256 unlockTimestamp;
        uint256 pendingRewards;
        uint256 lastUpdatedTimestamp;
        uint256 numStaked;
    }

    /**
     * @notice Emit when a user stakes a token
     * @param tokenId The token ID of the staked token
     * @param stakingToken The address of the staking token contract
     */
    event Staked(uint256 indexed tokenId, address indexed stakingToken);

    /**
     * @notice Emit when a user claims rewards
     * @param rewards The amount of rewards the user received
     * @param rewardsToken The address of the rewards token contract
     */
    event Claimed(uint256 indexed rewards, address indexed rewardsToken);

    /**
     * @notice Emit when a user unstakes
     * @param tokenId The token ID of the staked token
     * @param stakingToken The address of the staking token contract
     */
    event Unstaked(uint256 indexed tokenId, address indexed stakingToken);

    /**
     * @dev Emitted when the contract owner withdraws leftover rewards
     * @param owner The address of the contract owner
     * @param amount The amount of rewards withdrawn
     */
    event RewardLeftoverWithdrawal(address indexed owner, uint256 indexed amount);

    /**
     * @dev Emitted when the base URI is updated
     * @param baseURI The new base URI
     */
    event BaseURIUpdated(string baseURI);

    function stake(uint256[] calldata tokenIds, string[] calldata tokenURIs) external;

    function claim() external;

    function unstake(uint256[] memory tokenIds, bool exit) external;

    function setBaseURI(string memory baseUri) external;

    function setTokenURI(uint256 tokenId, string memory tokenUri) external;

    function withdrawLeftoverRewards() external;

    function getContractRewardsBalance() external view returns (uint256);

    function getPendingRewards() external view returns (uint256);

    function getRemainingLockTime() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

    function getInterfaceId() external pure returns (bytes4);
}
