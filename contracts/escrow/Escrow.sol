// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IEscrow } from "./IEscrow.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { OwnableOperatable } from "../access/OwnableOperatable.sol";


// TODO esc: should we rename this into "Wallet"?
contract Escrow is OwnableOperatable, IEscrow {
    using SafeERC20 for IERC20;

    /**
     * @notice Token contract operates on
     */
    IERC20 public token;

    /**
     * @notice Mapping for balances for every user of this escrow
     */
    mapping(address user => uint256 amount) public balances;

    constructor(address _token, address[] memory operators) OwnableOperatable() {
        if (_token.code.length == 0) revert AddressIsNotAContract(_token);

        token = IERC20(_token);

        if (operators.length > 0) {
            addOperators(operators);
        }
    }

    function deposit(uint256 amount) external override {
        if (amount == 0) revert ZeroAmountPassed();

        token.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;

        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount, bool all) external override {
        uint256 toWithdraw;
        if (all) {
            toWithdraw = balances[msg.sender];
            if (toWithdraw == 0) revert InsufficientFunds(msg.sender);
        } else {
            if (balances[msg.sender] < amount) revert InsufficientFunds(msg.sender);
            toWithdraw = amount;
        }

        balances[msg.sender] -= toWithdraw;
        token.safeTransfer(msg.sender, toWithdraw);

        emit Withdrawal(msg.sender, toWithdraw);
    }

    // TODO esc: do we even need this function ?? Maybe only to pay for user withdrawal txes
    //  if game messed up their payouts?..
    function releaseFunds(address user, uint256 amount) external override onlyAuthorized {
        if (balances[user] < amount) revert InsufficientFunds(user);
        balances[user] -= amount;
        token.safeTransfer(user, amount);

        emit FundsReleased(user, amount);
    }
}