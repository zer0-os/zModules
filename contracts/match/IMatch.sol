// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


interface IMatch {
    /** 
     * @notice Checks if all players have enough balance in escrow to participate in the match
     * @param players Array of player addresses
     * @param escrowRequired The required balance in escrow for each player to participate
     * @return bool Returns true if all players have enough balance, false otherwise
     */
    function canMatch(address[] memory players, uint256 escrowRequired) external view returns(bool);

    function startMatch(address[] calldata players, uint entryFee) external;

    function endMatch(uint matchId, address[] calldata winners, uint winAmount) external;

    function getMatchData(uint id) external view returns (uint, uint, uint, address[] memory);
}

