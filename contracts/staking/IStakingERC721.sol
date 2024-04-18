// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @notice Interface for ERC721 staking contract
 */
interface IStakingERC721 {
    /**
     * @notice Emit when a user stakes a token
     * @param tokenId The token ID of the staked token
     * @param stakingToken The address of the staking token
     */
    event Staked(uint256 indexed tokenId, address indexed stakingToken);

    /**
     * @notice Emit when a user claims rewards
     * @param rewards The amount of rewards the user received
     * @param rewardsToken The address of the staking token
     */
    event Claimed(uint256 indexed rewards, IERC20 indexed rewardsToken);

    /**
     * @notice Emit when a user unstakes
     * @param tokenId The token ID of the staked token
     * @param stakingToken The address of the staking token
     */
    event Unstaked(uint256 indexed tokenId, address indexed stakingToken);

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

    function stake(uint256[] calldata tokenIds) external;

    function claim() external;

    function unstake(uint256[] memory tokenIds, bool exit) external;

    function getContractRewardsBalance() external view returns (uint256);

    function getPendingRewards() external view returns (uint256);

    function getRemainingLockTime() external view returns (uint256);
}
