// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Escrow is Ownable{
    IERC20 public token; ///Token contract operates on
    address paymentAccount; //Account that tokens are trasfered from on executePayment
    mapping(address client => uint256 amount) public balance; ///Balance of given client

    constructor(address _token, address _paymentAccount, address _owner) {
        token = IERC20(_token);
        paymentAccount = _paymentAccount;
        Ownable(_owner);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Zero deposit amount");
        balance[msg.sender] += amount;
        token.transferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount); 
    }

    function withdraw() external {
        require(balance[msg.sender] > 0, "No balance to withdraw");
        uint balanceStore = balance[msg.sender];
        balance[msg.sender] = 0;
        token.transfer(msg.sender, balanceStore);

        emit Withdrew(msg.sender, balanceStore);
    }

    function executePayment(address to, uint256 amount) external onlyOwner {
        balance[to] += amount;
        token.transferFrom(paymentAccount, address(this), amount);

        emit PaymentExecuted(to, amount);
    }

    function refund(address client) external onlyOwner {
        require(balance[client] > 0, "No balance to refund");
        uint256 _balance = balance[client];
        balance[client] = 0;
        token.transfer(client, _balance);
        
        emit Refunded(client, _balance); //should these really be emitted? there are events in the transfer emitted already
    }

    event Deposited(address indexed client, uint256 amount);
    event Withdrew(address indexed client, uint256 amount);
    event PaymentExecuted(address indexed client, uint256 amount);
    event Refunded(address indexed client, uint256 amount);
}