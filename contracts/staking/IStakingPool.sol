// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Types } from "./Types.sol";

interface IStakingPool is Types {
    /**
     * @notice Emitted when a new staking pool is created
     */
    event PoolCreated(
        bytes32 indexed poolId,
        address indexed stakingToken,
        address indexed rewardsToken,
        uint256 poolWeight,
        uint256 periodLength,
        uint256 timeLockPeriod
    );
}