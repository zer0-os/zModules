// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // Correct import is Ownable, not Owned
import "../escrow/Escrow.sol";

contract Match is Ownable {
    Escrow public escrow;

    event Matched(bool canMatch);
    event PaymentExecuted(address winners, uint256 amount);

    constructor(address _owner, Escrow _escrow) Ownable() {
        transferOwnership(_owner); // Setting the owner to _owner
        escrow = _escrow;
    }

    /** @notice Checks if all players have enough balance in escrow to participate in the match
        @param players Array of player addresses
        @param escrowRequired The required balance in escrow for each player to participate
        @return bool Returns true if all players have enough balance, false otherwise
     */
    function canMatch(address[] memory players, uint256 escrowRequired) public view returns(bool) {
        for(uint i = 0; i < players.length; i++) {
            if(escrow.getBalance(players[i]) < escrowRequired) {
                return false;
            }
        }
        return true;
    }

    /** @notice Pays an equal amount from the escrow to each winner
        @param amount The amount to pay to each winner
        @param winners Array of winner addresses
     */
    function payAllEqual(uint256 amount, address[] memory winners) public onlyOwner {
        for(uint i = 0; i < winners.length; i++) {
            escrow.executePayment(winners[i], amount);
            emit PaymentExecuted(winners[i], amount);
        }
    }

    /** @notice Pays varying amounts from the escrow to each winner
        @param amounts Array of amounts to pay to each winner
        @param winners Array of winner addresses
     */
    function payAllAmounts(uint256[] memory amounts, address[] memory winners) public onlyOwner {
        require(amounts.length == winners.length, "Amounts and winners length mismatch");
        
        for(uint i = 0; i < winners.length; i++) {
            escrow.executePayment(winners[i], amounts[i]);
            emit PaymentExecuted(winners[i], amounts[i]);
        }
    }
}
