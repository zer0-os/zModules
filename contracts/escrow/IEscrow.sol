// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IEscrow {
    // TODO esc: fix NatSpec and add to main contract
    error InsufficientFunds(address user);
    error AddressIsNotAContract(address addr);
    error ZeroAddressPassed();
    error ZeroAmountPassed();
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
     * @notice Emit when a payment is executed to a user
     * @param user The address of the user who received the payment
     * @param amount The amount of tokens paid to the user
     */
    event Payment(address indexed user, uint256 amount);

    /**
     * @notice Emit when a payment is executed to a user
     * @param user The address of the user who received the payment
     * @param amount The amount of tokens paid to the user
     */
    event Charge(address indexed user, uint256 amount);

    /**
     * @notice Emit when tokens are refunded to a user
     * @param user The address of the user to whom the tokens were refunded
     * @param amount The amount of tokens refunded
     */
    event FundsReleased(address indexed user, uint256 amount);

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
     * @dev Executes a payment from the escrow to a winner.
     * @param user The address to receive tokens.
     * @param amount The amount of tokens they receive.
     */
    function pay(address user, uint256 amount) external;

    /**
     * @dev Executes a payment from the escrow to a winner.
     * @param user The address to receive tokens.
     * @param amount The amount of tokens they receive.
     */
    function charge(address user, uint256 amount) external;

    /**
     * @notice Pays varying amounts from the escrow to each winner
     * @param amounts Array of amounts to pay to each winner
     * @param winners Array of winner addresses
     */
    function payAllAmounts(uint256[] memory amounts, address[] memory winners) external;

    /**
     * @notice Charges varying amounts from the escrow to each winner
     * @param amounts Array of amounts to charge to each winner
     * @param winners Array of player addresses
     */
    function chargeAllAmounts(uint256[] memory amounts, address[] memory winners) external;

    /**
     * @dev Refunds tokens from the escrow back to a user by the contract owner or operator.
     * @param user The address of the user to refund tokens to.
     * @param amount The amount of tokens to release for the user.
     */
    function releaseFunds(address user, uint256 amount) external;
}