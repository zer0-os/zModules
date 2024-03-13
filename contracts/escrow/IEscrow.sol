// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEscrow {
    /**
     * @dev Allows a user to deposit tokens into the escrow contract.
     * @param _amount The amount of tokens to deposit.
     */
    function deposit(uint256 _amount) external;

    /**
     * @dev Checks the balance of tokens a user has in the escrow.
     * @param _client The address of the user.
     * @return The balance of tokens the user has in the escrow.
     */
    function getBalance(address _client) external view returns (uint256);

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