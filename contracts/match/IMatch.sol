// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


interface IMatch {
    /**
     * @notice Emitted when a match starts
     * @param players The array of player addresses participating in the match
     * @param entryFee The entry fee for the match
     */
    event MatchStarted(address[] players, uint entryFee);

    /**
     * @notice Emitted when a match ends
     * @param endTime The block.timestampe ended
     * @param winners The array of addresses of the winners of the match
     * @param amounts The array of amounts won by the winners
     */
    event MatchEnded(uint endTime, address[] winners, uint256[] amounts);

    /**
     * @notice Checks if all players have enough balance in escrow to participate in the match
     * @param players Array of player addresses
     * @param escrowRequired The required balance in escrow for each player to participate
     */
    function canMatch(address[] memory players, uint escrowRequired) external view;

    /**
     * @notice Starts a match and charges the entry fee from each player's balance
     * @param players Array of player addresses participating in the match
     * @param entryFee The entry fee for each player
     */
    function startMatch(address[] calldata players, uint entryFee) external;

    /**
     * @notice Ends a match, distributes the win amount to the winners, and records match data
     * @param matchId The ID of the match to end
     * @param winners Array of player addresses who won the match
     * @param winAmount The amount of tokens each winner will receive
     */
    function endMatch(uint matchId, address[] calldata winners, uint[] calldata winAmount) external;
}


