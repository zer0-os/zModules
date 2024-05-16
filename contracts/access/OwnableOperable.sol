// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IOwnableOperable } from "./IOwnableOperable.sol";


/**
 * @title OwnableOperable
 * @notice A contract that allows the owner to add and remove operators
 * @author Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract OwnableOperable is Ownable, IOwnableOperable {
    /**
     * @notice Mapping of operators to their status
     */
    mapping(address operator => bool valid) internal operators;

    modifier onlyAuthorized() {
        if (_msgSender() != owner() && !operators[_msgSender()])
            revert NotAuthorized(_msgSender());
        _;
    }

    constructor(address contractOwner) Ownable(contractOwner) {}

    function removeOperator(address operator) external override onlyOwner {
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }

    function isOperator(address operator) external view override returns (bool) {
        return operators[operator];
    }

    function addOperator(address operator) public override onlyOwner {
        if (operator == address(0)) revert ZeroAddressPassed();

        operators[operator] = true;
        emit OperatorAdded(operator);
    }

    function addOperators(address[] memory _operators) public override onlyOwner {
        for (uint256 i = 0; i < _operators.length; i++) {
            addOperator(_operators[i]);
        }
    }
}
