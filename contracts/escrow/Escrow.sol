// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IEscrow } from "./IEscrow.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract Escrow is Ownable, IEscrow {
    using SafeERC20 for IERC20;

    /**
     * @notice Token contract operates on
     */
    IERC20 public token;

    // TODO esc: what is this and do we need it?
    /**
     * @notice Account that tokens are transferred from on executePayment
     */
    address paymentAccount;

    /**
     * @notice Mapping for balances for every user of this escrow
     */
    mapping(address client => uint256 amount) public balances;

    constructor(IERC20 _token, address _owner) {
        // TODO esc: make custom errors
        require(address(_token) != address(0), "Token address cannot be 0");
        require(_owner != address(0), "Owner address cannot be 0");

        token = IERC20(_token);
        Ownable(_owner);
    }

    function deposit(uint256 amount) external override {
        require(amount > 0, "Zero deposit amount");

        token.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;

        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount, bool all) external override {
        uint256 toWithdraw;
        if (all) {
            toWithdraw = balances[msg.sender];
            require(toWithdraw > 0, "No balance to withdraw");
        } else {
            require(balances[msg.sender] >= amount, "Insufficient balance to withdraw");
            toWithdraw = amount;
        }

        balances[msg.sender] -= toWithdraw;
        token.safeTransfer(msg.sender, balanceStore);

        emit Withdrawal(msg.sender, balanceStore);
    }

    // TODO esc: how do we make this flow better and less risky?
    function pay(address client, uint256 amount) public override onlyOwner {
        require(token.balanceOf(address(this)) >= amount, "Contract not funded");
        balances[client] += amount;
        emit Payment(client, amount);
    }

    function charge(address client, uint256 amount) public override onlyOwner {
        balances[client] -= amount;
        emit Charge(client, amount);
    }

    function payAllAmounts(uint256[] memory amounts, address[] memory winners) external override onlyOwner {
        require(amounts.length == winners.length, "Amounts and winners length mismatch");

        for(uint i = 0; i < winners.length; i++) {
            pay(winners[i], amounts[i]);
        }
    }

    function chargeAllAmounts(uint256[] memory amounts, address[] memory clients) external override onlyOwner {
        require(amounts.length == clients.length, "Amounts and clients length mismatch");

        for(uint i = 0; i < clients.length; i++) {
            charge(clients[i], amounts[i]);
        }
    }

    function refund(address client) external override onlyOwner {
        require(balances[client] > 0, "No balance to refund");
        uint256 _balance = balances[client];
        balances[client] = 0;
        token.transfer(client, _balance);

        emit Refund(client, _balance); //should these really be emitted? there are events in the transfer emitted already
    }
}