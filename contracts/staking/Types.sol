// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


interface Types {
    struct Staker {
        uint256 unlockTimestamp;
        uint256 pendingRewards;
        uint256 lastUpdatedTimestamp;
        uint256 numStaked;
    }
}
