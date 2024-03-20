// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IStaking721 {
    event Staked(
        uint256 indexed tokenId,
        address indexed staker
    );
}