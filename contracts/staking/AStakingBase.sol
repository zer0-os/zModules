// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract AStakingBase {
    function getRemainingLockTime() external view virtual returns (uint256);

    function getPendingRewards() external view virtual returns (uint256);

    function getPendingRewardsLocked() external view virtual returns (uint256);

    function getTotalPendingRewards() external view virtual returns (uint256);}