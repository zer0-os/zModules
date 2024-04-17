// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IStaking } from "./IStaking.sol";

interface IStakingERC721 is IStaking {

    function stake(uint256[] calldata tokenIds) external;

    function claim() external;

    function unstake(uint256[] memory tokenIds, bool exit) external;

    function getContractRewardsBalance() external view returns (uint256);

    function getPendingRewards() external view returns (uint256);

    function getRemainingLockTime() external view returns (uint256);
}