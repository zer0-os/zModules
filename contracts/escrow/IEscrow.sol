// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IEscrow {
    /**
     * @notice Emit when tokens are deposited into the contract
     * @param client The address of the client who deposited the tokens
     * @param amount The amount of tokens deposited
     */
    event Deposit(address indexed client, uint256 amount);

    /**
     * @notice Emit when tokens are withdrawn from the contract
     * @param client The address of the client who withdrew the tokens
     * @param amount The amount of tokens withdrawn
     */
    event Withdrawal(address indexed client, uint256 amount);

    /**
     * @notice Emit when a payment is executed to a client
     * @param client The address of the client who received the payment
     * @param amount The amount of tokens paid to the client
     */
    event Payment(address indexed client, uint256 amount);

    /**
     * @notice Emit when a payment is executed to a client
     * @param client The address of the client who received the payment
     * @param amount The amount of tokens paid to the client
     */
    event Charge(address indexed client, uint256 amount);

    /**
     * @notice Emit when tokens are refunded to a client
     * @param client The address of the client to whom the tokens were refunded
     * @param amount The amount of tokens refunded
     */
    event Refund(address indexed client, uint256 amount);
    
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
     * @param client The address to receive tokens.
     * @param amount The amount of tokens they receive.
     */
    function pay(address client, uint256 amount) external;

    /**
     * @dev Executes a payment from the escrow to a winner.
     * @param client The address to receive tokens.
     * @param amount The amount of tokens they receive.
     */
    function charge(address client, uint256 amount) external;

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
     * @dev Refunds tokens from the escrow back to a user.
     * @param client The address of the user to refund tokens to.
     */
    function refund(address client) external;
}