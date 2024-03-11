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
     * @param _gamer The address of the user.
     * @return The balance of tokens the user has in the escrow.
     */
    function checkBalance(address _gamer) external view returns (uint256);

    /**
     * @dev Executes a payment from the escrow to a winner.
     * @param _winner The address of the winner to receive tokens.
     * @param _amount The amount of tokens the winner should receive.
     */
    function executePayment(address _winner, uint256 _amount) external;

    /**
     * @dev Refunds tokens from the escrow back to a user.
     * @param _gamer The address of the user to refund tokens to.
     */
    function refund(address _gamer) external;
}