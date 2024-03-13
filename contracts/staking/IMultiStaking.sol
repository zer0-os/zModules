// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Types} from "./Types.sol";

interface IMultiStaking {
    /**
     * @notice Emitted when a new staking pool is created
     */
    event PoolCreated(
        bytes32 indexed poolId,
        Types.PoolConfig config
    );

    /**
     * @notice Emitted when a staking pool is deleted
     */
    event PoolDeleted(bytes32 indexed poolId, address admin);

    /**
     * @notice Emitted when a user stakes into a pool
     */
    event Staked(
        Types.Stake indexed stake,
        address indexed staker
    );

    /**
     * @notice Emitted when a user claims rewards from an existing stake
     */
    // event Claimed(
    //     bytes32 indexed poolId,
    //     uint256 indexed tokenId,
    //     address indexed staker,
    //     uint256 rewardsAmount
    // );

    /**
     * @notice Emitted when a user unstakes from a pool
     */
    // event Unstaked(
    //     bytes32 indexed poolId,
    //     uint256 indexed tokenId,
    //     address indexed staker,
    //     uint256 rewardsAmount
    // );

    // function createPool(Types.StakeConfig memory _config) external;

	// only have in ABaseStaking?
    // function stake(bytes32 poolId, uint256 tokenId, uint256 amount) external;

    // function claim(bytes32 poolId, uint256 tokenId) external;

    // function unstake(bytes32 poolId, uint256 tokenId) external;

    // function isStaking(
    //     bytes32 poolId,
    //     uint256 tokenId
    // ) external view returns (bool);

    // function getPoolId(
    //     Types.StakeConfig memory _config
    // ) external pure returns (bytes32);

    // function getStakeId(
    //     bytes32 poolId,
    //     uint256 tokenId
    // ) external pure returns (bytes32);

    // function getAdmin() external view returns (address);

    // function getPendingRewards(
    //     bytes32 poolId,
    //     uint256 tokenId
    // ) external view returns (uint256);

    // function getRewardsPerBlock(bytes32 poolId) external view returns (uint256);

    // function getStakingToken(bytes32 poolId) external view returns (IERC721);

    // function getRewardsToken(bytes32 poolId) external view returns (IERC20);

    // function setAdmin(address _admin) external;

    // function deletePool(bytes32 poolId) external;
}
