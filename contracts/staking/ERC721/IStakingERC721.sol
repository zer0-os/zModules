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

        // Track if a token was locked when it was staked
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
     * @notice Throw when unstaking and caller is not owner of a token or tokenId is not staked
     */
    error InvalidOwnerOrStake();

    /**
     * @notice Throw when call to unstake makes no changes or is otherwise invalid
     */
    error InvalidUnstake();

    /**
     * @notice Throw when trying to transfer the representative sNFT
     */
    error NonTransferrableToken();

    function stakeWithLock(
        uint256[] calldata _tokenIds,
        string[] calldata _tokenUris,
        uint256 _lockDuration
    ) external;

    function stakeWithoutLock(
        uint256[] calldata _tokenIds,
        string[] calldata _tokenURIs
    ) external;

    function claim() external;

    function unstakeUnlocked(uint256[] memory _tokenIds) external;

    function unstakeLocked(uint256[] memory _tokenIds) external;

    function exit(uint256[] memory _tokenIds, bool _locked) external;

    function getPendingRewards() external view returns (uint256);

    function getRemainingLockTime() external view returns (uint256);

    function isLocked(address _staker, uint256 _tokenId) external view returns (bool);
}
