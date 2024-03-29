// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // Correct import is Ownable, not Owned
import "../escrow/Escrow.sol";
import "./IMatch.sol";

contract Match is Ownable, IMatch {
    Escrow public escrow;

    constructor(address _owner, Escrow _escrow) {
        Ownable(_owner);
        escrow = _escrow;
    }

    function payAllEqual(uint256 amount, address[] memory winners) external override onlyOwner {
        for(uint i = 0; i < winners.length; i++) {
            escrow.executePayment(winners[i], amount);
            emit PaymentExecuted(winners[i], amount);
        }
    }

    function payAllAmounts(uint256[] memory amounts, address[] memory winners) external override onlyOwner {
        require(amounts.length == winners.length, "Amounts and winners length mismatch");
        
        for(uint i = 0; i < winners.length; i++) {
            escrow.executePayment(winners[i], amounts[i]);
            emit PaymentExecuted(winners[i], amounts[i]);
        }
    }
    
    function setEscrow(Escrow newEscrow) external override onlyOwner {
        escrow = newEscrow;
    }

    function canMatch(address[] memory players, uint256 escrowRequired) external override view returns(bool) {
        for(uint i = 0; i < players.length; i++) {
            if(escrow.balance(players[i]) < escrowRequired) {
                return false;
            }
        }
        return true;
    }

    event Matched(bool canMatch);
    event PaymentExecuted(address winners, uint256 amount);
    event EscrowSet(address escrow);
}
