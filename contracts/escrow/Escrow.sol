// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract Escrow {
    address public owner;
    IERC20 public token;

    mapping(address => uint256) public balances;

    constructor(address _token) {
        owner = msg.sender;
        token = IERC20(_token);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    function deposit(uint256 _amount) external {
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        balances[msg.sender] += _amount;
    }

    function checkBalance(address client) external view returns (uint256) {
        return balances[client];
    }

    function executePayment(address client, uint256 _amount) external onlyOwner {
        require(balances[client] >= _amount, "Insufficient balance");
        require(token.transfer(client, _amount), "Transfer failed");
        balances[client] -= _amount;
    }

    function refund(address client) external onlyOwner {
        uint256 balance = balances[client];
        require(balance > 0, "No balance to refund");
        require(token.transfer(client, balance), "Transfer failed");
        balances[client] = 0;
    }
}