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
    event PaymentExecuted(address indexed client, uint256 amount);
    
    /**
     * @notice Emit when a tokens are locked for a client
     * @param client The address of the client who received the lock
     * @param amount The amount of tokens locked
     */
    event Locked(address indexed client, uint256 amount);
    
    /**
     * @notice Emit when tokens are unlocked for a client
     * @param client The address of the client who received the unlock
     * @param amount The amount of tokens unlocked
     */
    event Unlocked(address indexed client, uint256 amount);

    /**
     * @notice Emit when tokens are refunded to a client
     * @param client The address of the client to whom the tokens were refunded
     * @param amount The amount of tokens refunded
     */
    event Refunded(address indexed client, uint256 amount);
    
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
     * @notice Pays an equal amount from the escrow to each winner
     * @param amount The amount to pay to each winner
     * @param winners Array of winner addresses
     */
    function payAllEqual(uint256 amount, address[] memory winners) external;

    /** 
     * @notice Pays varying amounts from the escrow to each winner
     * @param amounts Array of amounts to pay to each winner
     * @param winners Array of winner addresses
     */
    function payAllAmounts(uint256[] memory amounts, address[] memory winners) external;

    /**
     * @dev Refunds tokens from the escrow back to a user.
     * @param _client The address of the user to refund tokens to.
     */
    function refund(address _client) external;
}