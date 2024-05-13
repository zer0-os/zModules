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

    constructor(address _token, address _owner) OwnableOperatable() {
        if (_token.code.length == 0) revert AddressIsNotAContract(_token);

        token = IERC20(_token);
    }

    function deposit(uint256 amount) external override {
        if (amount > 0) revert ZeroAmountPassed();

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

    // TODO esc: how do we make this flow better and less risky?
    function pay(address user, uint256 amount) public override onlyOwner {
        require(token.balanceOf(address(this)) >= amount, "Contract not funded");
        balances[user] += amount;
        emit Payment(user, amount);
    }

    // TODO esc: what to do with all these functions? which ones we need and where to put this logic?
    function charge(address user, uint256 amount) public override onlyOwner {
        balances[user] -= amount;
        emit Charge(user, amount);
    }

    function payAllAmounts(uint256[] memory amounts, address[] memory winners) external override onlyOwner {
        require(amounts.length == winners.length, "Amounts and winners length mismatch");

        for(uint i = 0; i < winners.length; i++) {
            pay(winners[i], amounts[i]);
        }
    }

    function chargeAllAmounts(uint256[] memory amounts, address[] memory users) external override onlyOwner {
        require(amounts.length == users.length, "Amounts and users length mismatch");

        for(uint i = 0; i < users.length; i++) {
            charge(users[i], amounts[i]);
        }
    }

    function releaseFunds(address user, uint256 amount) external override onlyAuthorized {
        if (balances[user] < amount) revert InsufficientFunds(user);
        balances[user] -= amount;
        token.safeTransfer(user, amount);

        emit FundsReleased(user, amount);
    }
}