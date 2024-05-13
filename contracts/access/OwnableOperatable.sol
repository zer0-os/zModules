// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IOwnableOperatable } from "./IOwnableOperatable.sol";


contract OwnableOperatable is Ownable, IOwnableOperatable {
    mapping(address => bool) internal operators;

    modifier onlyAuthorized() {
        if (msg.sender != owner() || !operators[msg.sender])
            revert NotAuthorized(msg.sender);
        _;
    }

    constructor() Ownable() {}

    function addOperator(address operator) external override onlyOwner {
        if (operator == address(0)) revert ZeroAddress();

        operators[operator] = true;
        emit OperatorAdded(operator);
    }

    function removeOperator(address operator) external override onlyOwner {
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }

    function isOperator(address operator) external view override returns (bool) {
        return operators[operator];
    }
}
