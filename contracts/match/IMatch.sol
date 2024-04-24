// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../escrow/Escrow.sol";

interface IMatch {
    /** 
     * @notice Checks if all players have enough balance in escrow to participate in the match
     * @param players Array of player addresses
     * @param escrowRequired The required balance in escrow for each player to participate
     * @return bool Returns true if all players have enough balance, false otherwise
     */
    function canMatch(address[] memory players, uint256 escrowRequired) external view returns(bool);
}