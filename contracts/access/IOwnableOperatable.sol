// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


interface IOwnableOperatable {
    error NotAuthorized(address caller);
    error ZeroAddress();

    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    function addOperator(address operator) external;

    function removeOperator(address operator) external;

    function isOperator(address operator) external view returns (bool);
}