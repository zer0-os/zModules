// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IVault {

    error InvalidProof();

    event Claimed(
        address indexed account,
        uint256 indexed amount,
        uint256 indexed lpAmount
    );

    function claim(
        bytes32[] memory proof,
        address account,
        uint256 wildAmount, // should have two amounts, WILD and LP
        uint256 lpAmount // should have two amounts, WILD and LP
    ) external;
}