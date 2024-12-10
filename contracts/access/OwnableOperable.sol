// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

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

    /**
     * @notice Removes an operator from the contract. Only callable by the owner
     * @param operator The address of the operator to remove
     */
    function removeOperator(address operator) external override onlyOwner {
        if (!operators[operator]) revert OperatorNotAssigned(operator);
        operators[operator] = false;
        emit OperatorRemoved(operator);
    }

    /**
     * @notice Checks if an address is an operator
     * @param operator The address to check
     * @return bool True if the address is an operator
     */
    function isOperator(address operator) external view override returns (bool) {
        return operators[operator];
    }

    /**
     * @notice Adds an operator to the contract. Only callable by the owner
     * @param operator The address of the new operator
     */
    function addOperator(address operator) public override onlyOwner {
        if (operator == address(0)) revert ZeroAddressPassed();
        if (operators[operator]) revert OperatorAlreadyAssigned(operator);

        operators[operator] = true;
        emit OperatorAdded(operator);
    }

    /**
     * @notice Adds multiple operators to the contract. Only callable by the owner
     * @param _operators The array of operator addresses to add
     */
    function addOperators(address[] memory _operators) public override onlyOwner {
        for (uint256 i = 0; i < _operators.length; ++i) {
            addOperator(_operators[i]);
        }
    }
}
