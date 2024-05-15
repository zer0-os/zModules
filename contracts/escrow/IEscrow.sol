// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IOwnableOperatable } from "../access/IOwnableOperatable.sol";


interface IEscrow is IOwnableOperatable {
    // TODO esc: fix NatSpec and add to main contract

    /**
     * @notice Emit when tokens are deposited into the contract
     * @param user The address of the user who deposited the tokens
     * @param amount The amount of tokens deposited
     */
    event Deposit(address indexed user, uint256 amount);

    /**
     * @notice Emit when tokens are withdrawn from the contract
     * @param user The address of the user who withdrew the tokens
     * @param amount The amount of tokens withdrawn
     */
    event Withdrawal(address indexed user, uint256 amount);

    /**
     * @notice Emit when tokens are refunded to a user
     * @param user The address of the user to whom the tokens were refunded
     * @param amount The amount of tokens refunded
     */
    event FundsReleased(address indexed user, uint256 amount);

    error InsufficientFunds(address user);
    error AddressIsNotAContract(address addr);
    error ZeroAmountPassed();

    /**
     * @dev Allows a user to deposit tokens into the escrow contract.
     * @param _amount The amount of tokens to deposit.
     */
    function deposit(uint256 _amount) external;

    /**
     * @dev Transfers balance to user.
     */
    function withdraw(uint256 amount, bool all) external;

    /**
     * @dev Refunds tokens from the escrow back to a user by the contract owner or operator.
     * @param user The address of the user to refund tokens to.
     * @param amount The amount of tokens to release for the user.
     */
    function releaseFunds(address user, uint256 amount) external;
}