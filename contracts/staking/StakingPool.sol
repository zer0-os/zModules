// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IStakingPool } from "./IStakingPool.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// TODO abstract?
contract StakingPool is IStakingPool {

    // Throw if staking configuration is invalid or already exists
    error InvalidStaking(string message);

    // Throw if the rewards configuration is non-zero and invalid
    error InvalidRewards(string message);

    function createPool(PoolConfig memory _config) external {
        _createPool(_config);
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _createPool(PoolConfig memory _config) internal {
        if (address(_config.stakingToken) == address(0)) {
            revert InvalidStaking("Pool: Staking token cannot be zero");
        }

        // Rewards configuration must be specified
        // TODO st: this may change when the rewards formula is developed
        if (_config.rewardWeight == 0) {
            revert InvalidRewards("Pool: Invalid rewards configuration");
        }
        // TODO st: figure out other checks when formula is done

        if (uint256(_config.stakingTokenType) > uint256(type(TokenType).max)) {
            // Enum for token types is
            // 0 - ERC721
            // 1 - ERC20
            // 2 - ERC1155
            revert InvalidStaking("Pool: Invalid staking token type");
        }

        bytes32 poolId = _getPoolId(_config);

        // Staking configuration must not already exist
        // if (address(pools[poolId].stakingToken) != address(0)) {
        //     revert InvalidStaking("Pool: Staking configuration already exists");
        // }

        // pools[poolId] = _config;
        emit PoolCreated(poolId, _config);
    }

    function _getPoolId(
        PoolConfig memory _config
    ) internal pure returns (bytes32) {
        return
            keccak256(
            abi.encodePacked(
                _config.stakingToken,
                _config.rewardsToken,
                _config.rewardWeight,
                _config.minRewardsTime
            )
        );
    }

    // TODO st: make this formula perfect, connect it to all the logic and swap this one.
    function _calculateRewards(
        uint256 timePassed,
        uint256 poolWeight,
        uint256 rewardPeriod,
        uint256 stakeAmount
    ) internal pure returns (uint256) {
        // TODO st: this formula is bad and is a placeholder for now !!
        return poolWeight * stakeAmount * timePassed / rewardPeriod;
    }
}
