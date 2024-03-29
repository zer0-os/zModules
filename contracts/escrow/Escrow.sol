// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Escrow is Ownable{
    IERC20 public token; ///Token contract operates on

    mapping(address client => uint256 amount) public balance; ///Balance of given client

    constructor(address _token, address _owner) {
        token = IERC20(_token);
        Ownable(_owner);
    }

    function deposit(uint256 amount) external {
        balance[msg.sender] += amount;
        token.transferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount); 
    }

    function executePayment(address to, uint256 amount) external onlyOwner {
        require(balance[to] >= amount, "Insufficient balance");
        balance[to] -= amount;
        token.transfer(to, amount);

        emit PaymentExecuted(to, amount);
    }

    function refund(address client) external onlyOwner {
        uint256 _balance = balance[client];
        require(_balance > 0, "No balance to refund");
        balance[client] = 0;
        token.transfer(client, _balance);
        
        emit Refunded(client, _balance); //should these really be emitted? there are events in the transfer emitted already
    }

    event Deposited(address indexed client, uint256 amount);
    event PaymentExecuted(address indexed client, uint256 amount);
    event Refunded(address indexed client, uint256 amount);
}