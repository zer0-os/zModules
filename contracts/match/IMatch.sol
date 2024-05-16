// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IEscrow } from "../escrow/IEscrow.sol";


/**
 * @notice struct MatchData
 * matchId - The ID of the match assigned by a game client or the operator of this contract
 * matchFee - The entry fee for the match
 * players - Array of player addresses participating in the match
 */
interface IMatch is IEscrow {
    struct MatchData {
        uint256 matchId;
        uint256 matchFee;
        address[] players;
    }

    /**
     * @notice Emitted when the `feeVault` address is set in state, an address where all the `gameFee`s go
     * @param feeVault The address of the fee vault
     */
    event FeeVaultSet(address feeVault);

    /**
     * @notice Emitted when a match is started by the contract operator/owner
     * @param matchDataHash The hash of the MatchData struct (`keccak256(abi.encode(matchData))`)
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     * @param players The array of player addresses participating in the match
     * @param matchFee The entry fee for the match
     * @param fundsLocked The total amount of tokens locked in escrow for the match (or `players.length * matchFee`)
     *  this is also a value that is saved to state in `fundLocks[matchDataHash]`
     */
    event MatchStarted(
        bytes32 indexed matchDataHash,
        uint256 indexed matchId,
        address[] indexed players,
        uint256 matchFee,
        uint256 fundsLocked
    );

    /**
     * @notice Emitted when a match is ended by the contract operator/owner
     * @param matchDataHash The hash of the MatchData struct (`keccak256(abi.encode(matchData))`)
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     * @param players The array of player addresses participating in the match (same length as `payouts`!)
     * @param payouts The amount of tokens each player will receive (same length as `players`!)
     * @param matchFee The entry fee for the match
     * @param gameFee The fee charged by the contract for hosting the match, will go to `feeVault`
     */
    event MatchEnded(
        bytes32 indexed matchDataHash,
        uint256 indexed matchId,
        address[] indexed players,
        uint256[] payouts,
        uint256 matchFee,
        uint256 gameFee
    );

    /**
     * @notice Reverted when the match data is incorrect or the payout amounts do not add up to `fundLocks`
     *  from `startMatch()` calls
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     * @param matchDataHash The hash of the MatchData struct (`keccak256(abi.encode(matchData))`)
     */
    error InvalidMatchOrPayouts(uint256 matchId, bytes32 matchDataHash);
    /**
     * @notice Reverted when a match is already started with the same `matchId` and `matchDataHash`
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     * @param matchDataHash The hash of the MatchData struct (`keccak256(abi.encode(matchData))`)
     */
    error MatchAlreadyStarted(uint256 matchId, bytes32 matchDataHash);
    /**
     * @notice Reverted when `players` array is passed as empty
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     */
    error NoPlayersInMatch(uint256 matchId);
    /**
     * @notice Reverted when the length of `players` and `payouts` arrays are different
     */
    error ArrayLengthMismatch();

    /**
     * @notice Starts a match, charges the entry fee from each player's balance, creates and hashes `MatchData` struct,
     *  and locks the total amount of tokens in escrow for the match, saving the amount to `fundLocks` mapping,
     *  mapped by `matchDataHash` as the key. Emits a `MatchStarted` event with all the data.
     * @dev Can ONLY be called by an authorized account!
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     * @param players Array of player addresses participating in the match
     * @param matchFee The entry fee for each player
     */
    function startMatch(uint256 matchId, address[] calldata players, uint256 matchFee) external;

    /**
     * @notice Ends a match, creates and hashes a MatchData struct with the data provided, validates that
     *  funds have been locked for this match previously (same match has been started), validates that
     *  `payouts + gameFee` add up to the total locked funds, transfers the payouts to the players,
     *  and emits a `MatchEnded` event.
     * @dev Can ONLY be called by an authorized account! Please note that the `fundLocks` mapping entry will be deleted
     *  for a gas refund, leaving historical data only in the event logs.
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     * @param players Array of player addresses (has to be the exact same array passed to `startMatch()`!)
     * @param payouts The amount of tokens each player will receive (pass 0 for players with no payouts!)
     *  Has to be the same length as `players`!
     * @param matchFee The entry fee for the match
     * @param gameFee The fee charged by the contract for hosting the match, will go to `feeVault`
     */
    function endMatch(
        uint256 matchId,
        address[] calldata players,
        uint256[] calldata payouts,
        uint256 matchFee,
        uint256 gameFee
    ) external;

    /**
     * @notice Sets the address of the fee vault where all the `gameFee`s go
     * @dev Can ONLY be called by an authorized account!
     * @param _feeVault The address of the new fee vault
     */
    function setFeeVault(address _feeVault) external;

    /**
     * @notice Gets the address of the fee vault where all the `gameFee`s go
     * @return feeVault The address of the fee vault
     */
    function getFeeVault() external view returns (address);

    /**
     * @notice Checks if all players have enough balance in escrow to participate in the match
     * @dev Note that the returned array will always be the same length as `players` array, with valid players
     *  being `address(0)` in the same index as the player in the `players` array. If all players have enough balance
     *  in escrow, the returned array will be filled with 0x0 addresses.
     * @param players Array of player addresses
     * @param matchFee The required balance in escrow for each player to participate
     * @return unfundedPlayers Array of player addresses who do not have enough balance in escrow
     */
    function canMatch(
        address[] calldata players,
        uint256 matchFee
    ) external view returns (
        address[] memory unfundedPlayers
    );
}


