// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IEscrow} from "./IEscrow.sol";


contract Escrow is IEscrow, Ownable{
    IERC20 public token; ///Token contract operates on
    address paymentAccount; ///Account that tokens are transfered from on executePayment
    mapping(address client => uint256 amount) public balance; ///Balance of given client

    constructor(IERC20 _token, address _owner) {
        token = IERC20(_token);
        Ownable(_owner);
    }

    function deposit(uint256 amount) external override{
        require(amount > 0, "Zero deposit amount");
        balance[msg.sender] += amount;
        token.transferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount); 
    }

    function withdraw() external override{
        require(balance[msg.sender] > 0, "No balance to withdraw");
        uint balanceStore = balance[msg.sender];
        balance[msg.sender] = 0;
        token.transfer(msg.sender, balanceStore);

        emit Withdrawal(msg.sender, balanceStore);
    }

    function pay(address client, uint256 amount) public override onlyOwner {
        require(token.balanceOf(address(this)) >= amount, "Contract not funded");
        balance[client] += amount;
        emit Payment(client, amount);
    }

    function charge(address client, uint256 amount) public override onlyOwner {
        balance[client] -= amount;
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
        require(balance[client] > 0, "No balance to refund");
        uint256 _balance = balance[client];
        balance[client] = 0;
        token.transfer(client, _balance);
        
        emit Refund(client, _balance); //should these really be emitted? there are events in the transfer emitted already
    }
}