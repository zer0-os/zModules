// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEscrow {
    /**
     * @dev Allows a user to deposit tokens into the escrow contract.
     * @param _amount The amount of tokens to deposit.
     */
    function deposit(uint256 _amount) external;
    
    /**
     * @dev Transfers balance to user.
     */
    function withdraw() external;
    
    /**
     * @dev Executes a payment from the escrow to a winner.
     * @param _to The address to receive tokens.
     * @param _amount The amount of tokens they receive.
     */
    function executePayment(address _to, uint256 _amount) external;

    /**
     * @dev Refunds tokens from the escrow back to a user.
     * @param _client The address of the user to refund tokens to.
     */
    function refund(address _client) external;
}