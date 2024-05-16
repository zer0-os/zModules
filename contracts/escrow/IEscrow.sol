// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IOwnableOperable } from "../access/IOwnableOperable.sol";


interface IEscrow is IOwnableOperable {
    /**
     * @notice Emitted when tokens are deposited into the contract
     * @param user The address of the user who deposited the tokens
     * @param amount The amount of tokens deposited
     */
    event Deposit(address indexed user, uint256 amount);

    /**
     * @notice Emitted when tokens are withdrawn from the contract
     * @param user The address of the user who withdrew the tokens
     * @param amount The amount of tokens withdrawn
     */
    event Withdrawal(address indexed user, uint256 amount);

    /**
     * @notice Emitted when tokens are refunded to a user by the contract owner or operator
     * @param user The address of the user to whom the tokens were refunded
     * @param amount The amount of tokens refunded
     */
    event FundsReleased(address indexed user, uint256 amount);

    /**
     * @notice Reverted when a user has insufficient funds in this Escrow for an operation
     */
    error InsufficientFunds(address user);
    /**
     * @notice Reverted when the address passed is not a contract
     */
    error AddressIsNotAContract(address addr);
    /**
     * @notice Reverted when zero amount is passed to the function
     *  to avoid 0 transfers.
     */
    error ZeroAmountPassed();

    /**
     * @notice Allows a user to deposit tokens into the escrow contract.
     * @param _amount The amount of tokens to deposit.
     */
    function deposit(uint256 _amount) external;

    /**
     * @notice Allows a user to withdraw funds from the escrow contract.
     * @dev Pass amount and `false` as `all` or `true` to withdraw all tokens and 0 as `amount`.
     * @param amount The amount of tokens to withdraw.
     * @param all If true, withdraws all tokens from the user's balance.
     */
    function withdraw(uint256 amount, bool all) external;

    /**
     * @notice Refunds tokens from the escrow back to a user by the contract owner or operator.
     * @param user The address of the user to refund tokens to.
     * @param amount The amount of tokens to release for the user.
     */
    function releaseFunds(address user, uint256 amount) external;
}