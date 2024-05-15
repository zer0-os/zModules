// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IEscrow } from "../escrow/IEscrow.sol";


interface IMatch is IEscrow {
    struct MatchData {
        uint256 matchId;
        uint256 matchFee;
        address[] players;
    }

    event FeeVaultSet(address feeVault);

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
        uint256 matchFee,
        uint256 gameFee
    );

    error InvalidMatchOrPayouts(uint256 matchId, bytes32 matchDataHash);
    error MatchAlreadyStarted(uint256 matchId, bytes32 matchDataHash);
    error NoPlayersInMatch(uint256 matchId);
    error ArrayLengthMismatch();

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

    function setFeeVault(address _feeVault) external;

    function getFeeVault() external view returns (address);

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
}


