// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IEscrow } from "../escrow/IEscrow.sol";


interface IMatch is IEscrow {
    // TODO esc: what else to add here ?
    struct MatchData {
        uint256 matchId;
        uint256 matchFee;
        address[] players;
    }

    // TODO esc: make sure we can actually read arrays in events !!!
    error PlayerWithInsufficientFunds(address player);
    error InvalidMatchOrPayouts(uint256 matchId, bytes32 matchDataHash);
    error MatchAlreadyStarted(uint256 matchId, bytes32 matchDataHash);
    error NoPlayersInMatch(uint256 matchId);
    error ArrayLengthMismatch();

    event WilderWalletSet(address wilderWallet);

    // TODO esc: fix all NatSpec everywhere!
    /**
     * @notice Emitted when a match starts
     * @param matchDataHash The hash of the MatchData struct
     * @param players The array of player addresses participating in the match
     * @param matchFee The entry fee for the match
     * @param fundsLocked The total amount of tokens locked in escrow for the match
     */
    event MatchStarted(
        bytes32 indexed matchDataHash,
        uint256 indexed matchId,
        address[] indexed players,
    // TODO esc: do we need this if we have fundsLocked?
        uint256 matchFee,
        uint256 fundsLocked
    );

    /**
     * @notice Emitted when a match ends
     * @param players The array of addresses of the players of the match
     * @param payouts The array of amounts won by the winners
     */
    event MatchEnded(
        bytes32 indexed matchDataHash,
        uint256 indexed matchId,
        address[] indexed players,
        uint256[] payouts,
        uint256 matchFee
    );

    /**
     * @notice Checks if all players have enough balance in escrow to participate in the match
     * @param players Array of player addresses
     * @param feeRequired The required balance in escrow for each player to participate
     * @return unfundedPlayers Array of player addresses who do not have enough balance in escrow
     */
    function canMatch(
        address[] calldata players,
        uint256 feeRequired
    ) external view returns (
        address[] memory unfundedPlayers
    );

    /**
     * @notice Starts a match and charges the entry fee from each player's balance
     * @param players Array of player addresses participating in the match
     * @param matchFee The entry fee for each player
     */
    function startMatch(uint256 matchId, address[] calldata players, uint256 matchFee) external;

    /**
     * @notice Ends a match, distributes the win amount to the winners, and records match data
     * @param matchId The ID of the match to end
     * @param players Array of player addresses who won the match
     * @param payouts The amount of tokens each winner will receive
     */
    function endMatch(
        uint256 matchId,
        address[] calldata players,
        uint256[] calldata payouts,
        uint256 matchFee,
        uint256 gameFee
    ) external;

    function setWilderWallet(address _wilderWallet) external;

    function getWilderWallet() external view returns (address);
}


