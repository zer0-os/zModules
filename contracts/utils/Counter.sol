// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


/**
 * @title Counter
 * @notice Simple counter contract used to test account abstraction with simple transactions
 */
contract Counter {
    mapping(address user => uint256 count) public counts;

    function increment() public {
        ++counts[msg.sender];
    }
}