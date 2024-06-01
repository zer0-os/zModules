// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IMatch } from "./IMatch.sol";
import { Escrow } from "../escrow/Escrow.sol";

/**
 * @title Match contract
 * @notice Contract for managing matches for escrow funds between players.
 * @author Kirill Korchagin <https://github.com/Whytecrowe>, Damien Burbine <https://github.com/durienb>
 */
contract Match is Escrow, IMatch {
    /**
     * @notice Mapping from the hash of `MatchData` struct
     *  to the total amount of tokens locked in escrow for the match
     */
    mapping(bytes32 matchDataHash => uint256 amount) public lockedFunds;

    /**
     * @notice The address of the fee vault which gathers all the `gameFee`s
     */
    address internal feeVault;

    // TODO esc: should the escrow be here as an external address saved vs money being store on this contract directly?
    //  this Escrow could be used in other contracts as well for other games.

    constructor(
        address _token,
        address _feeVault,
        address _owner,
        address[] memory _operators
    ) Escrow(_token, _owner, _operators) {
        if (_feeVault == address(0)) revert ZeroAddressPassed();

        feeVault = _feeVault;
    }

    /**
     * @notice Starts a match, charges the entry fee from each player's balance, creates and hashes `MatchData` struct,
     *  and locks the total amount of tokens in escrow for the match, saving the amount to `lockedFunds` mapping,
     *  mapped by `matchDataHash` as the key. Emits a `MatchStarted` event with all the data.
     * @dev Can ONLY be called by an authorized account!
     * @param matchId The ID of the match assigned by a game client or the operator of this contract
     * @param players Array of player addresses participating in the match
     * @param matchFee The entry fee for each player
     */
    function startMatch(
        uint256 matchId,
        address[] calldata players,
        uint256 matchFee
    ) external override onlyAuthorized {
        if (players.length == 0) revert NoPlayersInMatch(matchId);

        bytes32 matchDataHash = _getMatchDataHash(
            matchId,
            matchFee,
            players
        );

        if (lockedFunds[matchDataHash] != 0)
            revert MatchAlreadyStarted(matchId, matchDataHash);

        for (uint256 i = 0; i < players.length;) {
            if (!_isFunded(players[i], matchFee)) {
                revert InsufficientFunds(players[i]);
            }

            balances[players[i]] -= matchFee;

            unchecked { ++i; }
        }

        uint256 lockedAmount = matchFee * players.length;

        lockedFunds[matchDataHash] = lockedAmount;

        emit MatchStarted(matchDataHash, matchId, players, matchFee, lockedAmount);
    }

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
     * @param gameFee The fee charged by the contract for hosting the match, will go to `feeVault`
     */
    function endMatch(
        uint256 matchId,
        address[] calldata players,
        uint256[] calldata payouts,
        uint256 matchFee,
        uint256 gameFee
    ) external override onlyAuthorized {
        if (players.length != payouts.length) revert ArrayLengthMismatch();

        bytes32 matchDataHash = _getMatchDataHash(
            matchId,
            matchFee,
            players
        );

        uint256 lockedAmount = lockedFunds[matchDataHash];
        if (lockedAmount == 0) revert InvalidMatchOrPayouts(matchId, matchDataHash);

        delete lockedFunds[matchDataHash];

        uint256 payoutSum;
        for (uint256 i = 0; i < players.length;) {
            balances[players[i]] += payouts[i];
            payoutSum += payouts[i];

            unchecked { ++i; }
        }

        // It is important to calculate the payouts + gameFee correctly, avoiding rounding issues, before sending here
        // since the contract validates the correctness of the amounts sent and will revert if they
        // do not add up exactly to the lockedAmount for the match
        if (payoutSum + gameFee != lockedAmount) revert InvalidMatchOrPayouts(matchId, matchDataHash);

        balances[feeVault] += gameFee;

        emit MatchEnded(
            matchDataHash,
            matchId,
            players,
            payouts,
            matchFee,
            gameFee
        );
    }

    /**
     * @notice Sets the address of the fee vault where all the `gameFee`s go
     * @dev Can ONLY be called by an authorized account!
     * @param _feeVault The address of the new fee vault
     */
    function setFeeVault(address _feeVault) external override onlyAuthorized {
        if (_feeVault == address(0)) revert ZeroAddressPassed();

        feeVault = _feeVault;
        emit FeeVaultSet(_feeVault);
    }

    /**
     * @notice Gets the address of the fee vault where all the `gameFee`s go
     * @return feeVault The address of the fee vault
     */
    function getFeeVault() external override view returns (address) {
        return feeVault;
    }

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
    ) external view override returns (
        address[] memory unfundedPlayers
    ) {
        unfundedPlayers = new address[](players.length);

        uint256 k;
        for (uint256 i = 0; i < players.length;) {
            if (!_isFunded(players[i], matchFee)) {
                unfundedPlayers[k] = players[i];
                unchecked { ++k; }
            }

            unchecked { ++i; }
        }

        return unfundedPlayers;
    }

    function _isFunded(address player, uint256 amountRequired) internal view returns (bool) {
        return balances[player] >= amountRequired;
    }

    function _getMatchDataHash(
        uint256 matchId,
        uint256 matchFee,
        address[] calldata players
    ) internal pure returns (bytes32) {
        MatchData memory matchData = MatchData({
            matchId: matchId,
            matchFee: matchFee,
            players: players
        });

        return keccak256(abi.encode(matchData));
    }
}
