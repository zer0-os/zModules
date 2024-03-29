// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Escrow {
    address public owner; ///Owner of the contract
    IERC20 public token; ///Token contract operates on

    mapping(address client => uint256 amount) public balance; ///Balance of given client

    constructor(address _token, address _owner) {
        token = IERC20(_token);
        owner = _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    function deposit(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        balance[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    function executePayment(address to, uint256 amount) external onlyOwner {
        require(balance[to] >= amount, "Insufficient balance");
        token.transfer(to, amount);
        balance[to] -= amount;

        emit PaymentExecuted(to, amount);
    }

    function refund(address client) external onlyOwner {
        uint256 _balance = balance[client];
        require(_balance > 0, "No balance to refund");
        
        token.transfer(client, _balance);
        balance[client] = 0;

        emit Refunded(client, _balance); 
    }

    event Deposited(address client, uint256 amount);
    event PaymentExecuted(address client, uint256 amount);
    event Refunded(address client, uint256 amount);
}