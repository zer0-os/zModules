// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { IStakingBase } from "../IStakingBase.sol";

/**
 * @title IStakingERC721
 * @notice Interface for the StakingERC721 contract
 */
interface IStakingERC721 is IERC721Receiver, IStakingBase {

    /**
     * @notice Struct to track ERC721 specific data for a staker
     */
    struct NFTStaker {
        Staker stake;

        // A) have array of token ids AND `staked` mapping
        // This way we can mark tokens as `unstaked` without iterating
        // `tokenIds` array each time.
        // B) we can just remove the `unstakeAll` option because the front end could do this
        // Considering we don't yet have a subgraph for this it might be tricky
        uint256[] tokenIds; // use sNFT as proof of ownership of stake, and `amountStaked(locked)` as quantity
        // TODO look at gas costs for this and see if off chain tids is a better solution (with a subgraph)
        mapping(uint256 tokenId => bool staked) staked;
        mapping(uint256 tokenId => bool locked) locked;
    }

    /**
     * @notice Emit when a user stakes a token
     * @param staker The address of the user staking
     * @param tokenId The token ID of the staked token
     */
    event Staked(
        address indexed staker,
        uint256 indexed tokenId
    );

    /**
     * @notice Emit when a user unstakes
     * @param staker The address of the user unstaking
     * @param tokenId The token ID of the staked token
     */
    event Unstaked(
        address indexed staker,
        uint256 indexed tokenId
    );

    /**
     * @notice Throw when caller is not the sNFT owner
     */
    error InvalidOwner();

    /**
     * @notice Throw when call to unstake makes no changes
     */
    error InvalidUnstake();

    /**
     * @notice Throw when trying to transfer the representative sNFT
     */
    error NonTransferrableToken();

    function stakeWithLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris,
        uint256 lockDuration
    ) external;

    function stakeWithoutLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenURIs
    ) external;

    function claim() external;

    function unstake(uint256[] memory tokenIds, bool exit) external;

    function unstakeAll(bool exit) external;

    function getStakedTokenIds() external view returns(uint256[] memory);

    function getPendingRewards() external view returns (uint256);

    function getRemainingLockTime() external view returns (uint256);
}
