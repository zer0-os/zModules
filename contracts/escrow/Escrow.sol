// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IEscrow } from "./IEscrow.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { OwnableOperable } from "../access/OwnableOperable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/**
 * @title Escrow
 * @notice A simple general contract for holding tokens in escrow for multiple users
 * @author Kirill Korchagin <https://github.com/Whytecrowe>, Damien Burbine <https://github.com/durienb>
 */
contract Escrow is OwnableOperable, ReentrancyGuard, IEscrow {
    using SafeERC20 for IERC20;

    /**
     * @notice Token contract operates on
     */
    IERC20 public token;

    /**
     * @notice Mapping of balances for every user of this escrow
     */
    mapping(address user => uint256 amount) public balances;

    constructor(
        address _token,
        address _owner,
        address[] memory _operators
    ) OwnableOperable(_owner) {
        if (_token.code.length == 0) revert AddressIsNotAContract(_token);

        token = IERC20(_token);

        if (_operators.length > 0) {
            addOperators(_operators);
        }
    }

    /**
     * @notice Allows a user to deposit tokens into the escrow contract.
     * @param amount The amount of tokens to deposit.
     */
    function deposit(uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroAmountPassed();

        // this logic is here to support deflationary tokens
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        token.safeTransferFrom(msg.sender, address(this), amount);

        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        uint256 amountTransferred = balanceAfter - balanceBefore;

        balances[msg.sender] += amountTransferred;

        emit Deposit(msg.sender, amount, amountTransferred);
    }

    /**
     * @notice Allows a user to withdraw funds from the escrow contract.
     * @param amount The amount of tokens to withdraw.
     */
    function withdraw(uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroAmountPassed();
        if (balances[msg.sender] < amount) revert InsufficientFunds(msg.sender);

        balances[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);

        emit Withdrawal(msg.sender, amount);
    }
}