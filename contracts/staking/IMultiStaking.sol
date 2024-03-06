// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface IMultiStaking {
    /**
     * @notice The necessary details for a single staking pool comfiguration
     * @param stakingToken The ERC721 token that is being staked
     * @param rewardsToken The ERC20 token that is being distributed as rewards
     * @param rewardsPerBlock The amount of rewards tokens distributed per block
     */
    // TODO should we make configs with tokens as ERC20 (e.g. stake $WILD)
    // or rewards tokens as ERC721 (e.g. earn a WilderWheel)?
    struct StakeConfig {
        IERC721Upgradeable stakingToken;
        IERC20Upgradeable rewardsToken;
        uint256 rewardsPerBlock;
    }

    /**
     * @notice Emitted when a new staking pool is created
     */
    event PoolCreated(
        bytes32 indexed poolId,
        StakeConfig config,
        address admin
    );

    /**
     * @notice Emitted when a staking pool is deleted
     */
    event PoolDeleted(bytes32 indexed poolId, address admin);

    /**
     * @notice Emitted when a user stakes into a pool
     */
    event Staked(
        bytes32 indexed poolId,
        uint256 indexed tokenId,
        address indexed staker
    );

    /**
     * @notice Emitted when a user claims rewards from an existing stake
     */
    event Claimed(
        bytes32 indexed poolId,
        uint256 indexed tokenId,
        address indexed staker,
        uint256 rewardsAmount
    );

    /**
     * @notice Emitted when a user unstakes from a pool
     */
    event Unstaked(
        bytes32 indexed poolId,
        uint256 indexed tokenId,
        address indexed staker,
        uint256 rewardsAmount
    );

    function initialize(string memory name, string memory symbol) external;

    function createPool(StakeConfig memory _config) external;

    function stake(bytes32 poolId, uint256 tokenId) external;

    function claim(bytes32 poolId, uint256 tokenId) external;

    function unstake(bytes32 poolId, uint256 tokenId) external;

    function isStaking(
        bytes32 poolId,
        uint256 tokenId
    ) external view returns (bool);

    function getPoolId(
        StakeConfig memory _config
    ) external pure returns (bytes32);

    function getStakeId(
        bytes32 poolId,
        uint256 tokenId
    ) external pure returns (bytes32);

    function getAdmin() external view returns (address);

    function getPendingRewards(
        bytes32 poolId,
        uint256 tokenId
    ) external view returns (uint256);

    function getRewardsPerBlock(bytes32 poolId) external view returns (uint256);

    function getStakingToken(
        bytes32 poolId
    ) external view returns (IERC721Upgradeable);

    function getRewardsToken(
        bytes32 poolId
    ) external view returns (IERC20Upgradeable);

    function setAdmin(address _admin) external;

    function deletePool(bytes32 poolId) external;
}
