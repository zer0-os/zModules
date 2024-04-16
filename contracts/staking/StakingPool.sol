// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IStakingPool } from "./IStakingPool.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract StakingPool is IStakingPool {

    // Throw if staking configuration is invalid or already exists
    error InvalidStaking(string message);

    // Throw if the rewards configuration is non-zero and invalid
    error InvalidRewards(string message);

	////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _createPool(PoolConfig memory _config) internal {
        if (address(_config.stakingToken) == address(0)) {
            revert InvalidStaking("Pool: Staking token cannot be zero");
        }

        // Rewards configuration must be specified
        if (address(_config.rewardsToken) == address(0)) {
            revert InvalidRewards("Pool: Invalid rewards configuration");
        }

        // TODO st: Figure out if we need this for erc1155 or not
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

        bytes32 poolId = _getPoolId(_config);

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

    event Debug(
        uint256 val1,
        uint256 val2,
        uint256 val3,
        uint256 val4
    );

    /**
     * @notice Calculate rewards for a staker
     * @dev Returns 0 if time lock period is not passed
     * @param timePassed Time passed since last stake or claim, in seconds
     * @param stakeAmount Amount of staking token staked
     * @param config Pool configuration
     */
    function _calculateRewards(
        uint256 timePassed,
        uint256 stakeAmount,
        PoolConfig memory config
    ) internal pure returns (uint256) { // TODO make pure
        // emit Debug(
        //     config.poolWeight,
        //     stakeAmount,
        //     timePassed,
        //     config.periodLength
        // );

        // use safemath?
        return config.poolWeight * stakeAmount * (timePassed / config.periodLength);
    }
}
