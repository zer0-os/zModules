// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


interface IOwnableOperatable {
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    error NotAuthorized(address caller);
    error ZeroAddressPassed();

    function addOperator(address operator) external;

    function addOperators(address[] calldata _operators) external;

    function removeOperator(address operator) external;

    function isOperator(address operator) external view returns (bool);
}