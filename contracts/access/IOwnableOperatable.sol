// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


interface IOwnableOperatable {
    // TODO esc: refactor common errors into a separate file
    error NotAuthorized(address caller, address azz);
    error ZeroAddressPassed();

    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    function addOperator(address operator) external;

    function addOperators(address[] calldata _operators) external;

    function removeOperator(address operator) external;

    function isOperator(address operator) external view returns (bool);
}