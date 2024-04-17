// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IStakingPool } from "./IStakingPool.sol";

contract StakingPool is IStakingPool {

    // Throw if staking configuration is invalid or already exists
    error InvalidStaking(string message);

    // Throw if the rewards configuration is non-zero and invalid
    error InvalidRewards(string message);

	////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _createPool(
        address _stakingToken,
        address _rewardsToken,
        uint256 _poolWeight,
        uint256 _periodLength,
        uint256 _timeLockPeriod
    ) internal {
        if (address(_stakingToken) == address(0)) {
            revert InvalidStaking("Pool: Staking token cannot be zero");
        }

        // Rewards configuration must be specified
        if (address(_rewardsToken) == address(0)) {
            revert InvalidRewards("Pool: Invalid rewards configuration");
        }

        // TODO st: Figure out if we need type testing for erc1155 or not
		// would be a safer way to test what type contract the staking token is
        // if (uint256(_config.stakingTokenType) > uint256(type(TokenType).max)) {
        //     // Enum for token types is
        //     // 0 - ERC721
        //     // 1 - ERC20
        //     // 2 - ERC1155
        //     revert InvalidStaking("Pool: Invalid staking token type");
        // }
        // TODO st: need supportsInterface check to more certainly verify staking token being used
        // more of a problem when zero uses this, not WW

        bytes32 poolId = _getPoolId(
            _stakingToken,
            _rewardsToken,
            _poolWeight,
            _timeLockPeriod
        );

        emit PoolCreated(
            poolId,
            _stakingToken,
            _rewardsToken,
            _poolWeight,
            _periodLength,
            _timeLockPeriod
        );
    }

    function _getPoolId(
        address _stakingToken,
        address _rewardsToken,
        uint256 _poolWeight,
        uint256 _timeLockPeriod
    ) internal pure returns (bytes32) {
        return
            keccak256(
            abi.encodePacked(
                _stakingToken,
                _rewardsToken,
                _poolWeight,
                _timeLockPeriod
            )
        );
    }

    /**
     * @notice Calculate rewards for a staker
     * @dev Returns 0 if time lock period is not passed
     * @param timePassed Time passed since last stake or claim, in seconds
     * @param stakeAmount Amount of staking token staked
     * @param poolWeight Weight of the pool
     * @param periodLength Length of the reward period, in seconds
     */
    function _calculateRewards(
        uint256 timePassed,
        uint256 stakeAmount,
        uint256 poolWeight,
        uint256 periodLength
    ) internal pure returns (uint256) { // TODO make pure
        return poolWeight * stakeAmount * (timePassed / periodLength);
    }
}
