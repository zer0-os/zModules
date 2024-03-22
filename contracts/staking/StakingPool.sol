// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IStakingPool } from "./IStakingPool.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract StakingPool is IStakingPool {

    // Throw if staking configuration is invalid or already exists
    error InvalidStaking(string message);

    // Throw if the rewards configuration is non-zero and invalid
    error InvalidRewards(string message);

    function createPool(PoolConfig memory _config) external {
        _createPool(_config);
    }

    // TODO st: perhaps create a constructor here that allows creation of several
    // pools still, just as `new StakingERC721(...), new StakingERC20(...)` etc.

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _createPool(PoolConfig memory _config) internal {
        if (address(_config.stakingToken) == address(0)) {
            revert InvalidStaking("Pool: Staking token cannot be zero");
        }

        // Rewards configuration must be specified
        // TODO st: this may change when the rewards formula is developed
        if (_config.rewardsFraction == 0) {
            revert InvalidRewards("Pool: Invalid rewards configuration");
        }
        // TODO st: figure out other checks when formula is done

        // if (uint256(_config.stakingTokenType) > uint256(type(TokenType).max)) {
        //     // Enum for token types is
        //     // 0 - ERC721
        //     // 1 - ERC20
        //     // 2 - ERC1155
        //     revert InvalidStaking("Pool: Invalid staking token type");
        // }

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
                _config.rewardsFraction,
                _config.timeLockPeriods
            )
        );
    }

    // TODO st: make this formula perfect, connect it to all the logic and swap this one.
    function _calculateRewards(
        uint256 timePassedSinceLastClaimOrStake, // in seconds, block.timeStamp, convert to days
        uint256 stakeAmount,
        PoolConfig memory config
    ) internal pure virtual returns (uint256) {

        // virtual so can be overridden by erc721, but erc20 and erc1155 can use this function I think
        // TODO is there a Time module that's better for this?
        // 86400 seconds in 1 day
        uint256 timePassedDays = timePassedSinceLastClaimOrStake / 86400; // do / 24 hours ???
        uint256 timeRequiredToClaim = config.rewardsPeriod * config.timeLockPeriods;
        // one period is 7 days, require 2 periods to have passed before claiming, so 14 days

        if (timePassedDays < timeRequiredToClaim) {
            return 0; // TODO revert error?
        }

        // ERC721, or non-fungible ERC1155
        if (stakeAmount == 1) {
            return config.rewardsPerPeriod * timeRequiredToClaim;
        } else {
            // ERC20, or fungible ERC1155
            return stakeAmount * (stakeAmount / config.rewardsFraction);
            // TODO temp formula, need to see if we want rewardsRatio with ERC4626
        }
        // we need
            // time period
            // rate at which we generate rewards (fraction of tokens staked per period)
            // time lock (mininmum number of periods)
        // return poolWeight * stakeAmount * timePassed / rewardPeriod;
    }
}
