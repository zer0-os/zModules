// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import { IEscrow } from "../escrow/IEscrow.sol";


/**
 * @notice struct MatchData
 * - matchId (uint256) - The ID of the match assigned by a game client or the operator of this contract
 * - matchFee (uint256) - The entry fee for the match
 * - players (address[]) - Array of player addresses participating in the match
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
     *  this is also a value that is saved to state in `lockedFunds[matchDataHash]`
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
     * @notice Emitted when the `gameFeePercentage` is set in state
     * @param percentage The percentage value (as part of 10,000) that is set
     */
    event GameFeePercentageSet(uint256 percentage);

    /**
     * @notice Reverted when the match data passed to the contract is incorrect
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     * @param matchDataHash The hash of the MatchData struct (`keccak256(abi.encode(matchData))`)
     */
    error InvalidMatchOrMatchData(uint256 matchId, bytes32 matchDataHash);
    /**
     * @notice Reverted when the payout amounts passed as `payouts` array to `endMatch()` are calculated incorrectly,
     * and their sum + `gameFee` do not add up to the total `lockedFunds` set by `startMatch()`
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     */
    error InvalidPayouts(uint256 matchId);
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
     * @notice Reverted when the match fee is set to 0
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     */
    error ZeroMatchFee(uint256 matchId);
    /**
     * @notice Reverted when setting `gameFeePercentage` as a wrong value (as part of 10,000)
     * @param percentage The percentage value passed to the function
     */
    error InvalidPercentageValue(uint256 percentage);

    /**
     * @notice Starts a match, charges the entry fee from each player's balance, creates and hashes `MatchData` struct,
     *  and locks the total amount of tokens in escrow for the match, saving the amount to `lockedFunds` mapping,
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
     * @dev Can ONLY be called by an authorized account! Note that the `lockedFunds` mapping entry will be deleted
     *  for a gas refund, leaving historical data only in the event logs.
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     * @param players Array of player addresses (has to be the exact same array passed to `startMatch()`!)
     * @param payouts The amount of tokens each player will receive (pass 0 for players with no payouts!)
     *  Has to be the same length as `players`!
     * @param matchFee The entry fee for the match
     */
    function endMatch(
        uint256 matchId,
        address[] calldata players,
        uint256[] calldata payouts,
        uint256 matchFee
    ) external;

    /**
     * @notice Sets the address of the fee vault where all the `gameFee`s go
     * @dev Can ONLY be called by an authorized account!
     * @param _feeVault The address of the new fee vault
     */
    function setFeeVault(address _feeVault) external;

    /**
     * @notice Sets the percentage of the `matchFee` per match that is charged for hosting the match
     * by the game. Represented as parts of 10,000 (100% = 10,000)
     * @dev Can ONLY be called by the OWNER!
     * @param _gameFeePercentage The percentage value to set
     */
    function setGameFeePercentage(uint256 _gameFeePercentage) external;
}


