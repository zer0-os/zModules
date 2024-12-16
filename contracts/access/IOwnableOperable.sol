// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


interface IOwnableOperable {
    /**
     * @notice Emitted when an operator is added to the contract by the owner
     * @param operator The address of the new operator
     */
    event OperatorAdded(address indexed operator);
    /**
     * @notice Emitted when an operator is removed from the contract by the owner
     * @param operator The address of the operator to be removed
     */
    event OperatorRemoved(address indexed operator);

    /**
     * @notice Reverted when the caller is not the owner or an operator
     * @param caller The address of the caller
     */
    error NotAuthorized(address caller);
    /**
     * @notice Reverted when the zero address is passed to the function
     */
    error ZeroAddressPassed();
    /**
     * @notice Reverted when the operator is already added
     * @param operator The address of the operator
     */
    error OperatorAlreadyAssigned(address operator);
    /**
     * @notice Reverted when the operator is not assigned
     * @param operator The address of the operator
     */
    error OperatorNotAssigned(address operator);

    /**
     * @notice Adds an operator to the contract. Only callable by the owner
     * @param operator The address of the new operator
     */
    function addOperator(address operator) external;

    /**
     * @notice Adds multiple operators to the contract. Only callable by the owner
     * @param _operators The array of operator addresses to add
     */
    function addOperators(address[] calldata _operators) external;

    /**
     * @notice Removes an operator from the contract. Only callable by the owner
     * @param operator The address of the operator to remove
     */
    function removeOperator(address operator) external;

    /**
     * @notice Checks if an address is an operator
     * @param operator The address to check
     * @return bool True if the address is an operator
     */
    function isOperator(address operator) external view returns (bool);
}