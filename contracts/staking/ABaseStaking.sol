// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Types} from "./Types.sol";

abstract contract ABaseStaking is Types {

	function stake(bytes32 poolId, uint256 tokenId) external virtual;

	function unstake(bytes32 poolId, uint256 tokenId) external virtual;

	function claim(bytes32 poolId, uint256 tokenId) external virtual;
}