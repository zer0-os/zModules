// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import { MockERC20 } from "./MockERC20.sol";


contract DeflERC20Mock is MockERC20 {
    // 10% fee that is burned for each transaction
    uint8 private _fee = 10;

    constructor(string memory name, string memory symbol) MockERC20(name, symbol) {}

    function getFee(uint256 amount) public view returns (uint256) {
        return (amount * _fee) / 100;
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        uint256 feeAmount = getFee(value);
        uint256 transferAmount = value - feeAmount;

        if (from == address(0)) {
            // Minting
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
            // Overflow not possible: value <= fromBalance <= totalSupply.
            // Fee comes from user's balance
                _totalSupply -= feeAmount;
                _balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            // Burning
            unchecked {
            // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
            // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += transferAmount;
            }
        }

        emit Transfer(from, to, transferAmount);
    }
}
