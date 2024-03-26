// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IStakingPool } from "./IStakingPool.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract StakingPool is IStakingPool {

    // Throw if staking configuration is invalid or already exists
    error InvalidStaking(string message);

    // Throw if the rewards configuration is non-zero and invalid
    error InvalidRewards(string message);

	// TODO need public `createPool` function?
    
	////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _createPool(PoolConfig memory _config) internal {
        if (address(_config.stakingToken) == address(0)) {
            revert InvalidStaking("Pool: Staking token cannot be zero");
        }

        // Rewards configuration must be specified
        // TODO st: this may change when the rewards formula is developed
        if (address(_config.rewardsToken) == address(0)) {
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
        // TODO st: need supportsInterface check to more certainly verify staking token being used
        // more of a problem when zero uses this, not WW

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
                _config.poolWeight,
                _config.timeLockPeriod
            )
        );
    }

    // debug funcs

    function _showValues(
        uint256 timePassed, // in seconds, time since last claim or stake
        uint256 stakeAmount, // is 1 in NFT case
        PoolConfig memory config
    ) internal view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        return (
            timePassed,
            stakeAmount,
            config.poolWeight,
            config.periodLength,
            config.timeLockPeriod,
            timePassed / config.periodLength
        );
    }

    function _showValues2(
        uint256 timePassed, // in seconds, time since last claim or stake
        PoolConfig memory config
    ) internal view returns (uint256, bool) {
        return (
            timePassed / config.periodLength,
            timePassed / config.periodLength < config.timeLockPeriod
        );
    }

    // TODO st: make this formula perfect, connect it to all the logic and swap this one.
    function _calculateRewards(
        uint256 timePassed, // in seconds, time since last claim or stake
        uint256 stakeAmount, // is 1 in NFT case
        PoolConfig memory config
    ) internal pure returns (uint256) {
        // 86400 seconds in 1 day
        // uint256 timePassedDays = timePassed / 86400;
        // uint256 timePassedPeriods = timePassedDays / config.rewardsPeriod; // num periods that have passed

        // config.timeLockPeriods;
        // one period is 7 days, require 2 periods to have passed before claiming, so 14 days

        // timePassedPeriods = timePassedDays / config.rewardsPeriod;
        if (timePassed < config.timeLockPeriod) {
            return 0;
        }

        return 10**18 * config.poolWeight * stakeAmount * timePassed / config.periodLength / 10**18;

        // rewardsPerPeriod * (howManyPeriodsHavePassed) * (stakeAmount) * (% of stake amount)

        // "rewardsPerPeriod * x% of their stake * length of their stake"


        // rewardsPerPeriod * (stakeAmount / config.rewardsFraction) * (timePassed / config.rewardsPeriodLength);

        // rewardFraction would be higher in NFT pool so now outdone by ERC20 pool

        // TODO remove if statement
        // ERC721, or non-fungible ERC1155
        // if (stakeAmount == 1) {
        //     // TODO ideally shouldnt need if statement can combine logic
        //     // TODO bring to damien, then he can go to escrow
        //     return config.pool * (timePassed / config.rewardsPeriodLength);
        // } else {
        //     // ERC20, or fungible ERC1155
        //     return stakeAmount * (stakeAmount / config.rewardsFraction);
        //     // TODO temp formula, need to see if we want rewardsRatio with ERC4626
        // }
        // we need
            // time period
            // rate at which we generate rewards (fraction of tokens staked per period)
            // time lock (mininmum number of periods)
        // return poolWeight * stakeAmount * timePassed / rewardPeriod;
    }
}
