// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IMatch } from "./IMatch.sol";
import { Escrow } from "../escrow/Escrow.sol";

// TODO esc: add authors to NatSpec
contract Match is Escrow, IMatch {

    mapping(bytes32 matchDataHash => uint256 amount) public fundLocks;

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

        if (fundLocks[matchDataHash] != 0)
            revert MatchAlreadyStarted(matchId, matchDataHash);

        for (uint256 i = 0; i < players.length;) {
            if (!_isFunded(players[i], matchFee)) {
                revert InsufficientFunds(players[i]);
            }

            balances[players[i]] -= matchFee;

            unchecked { ++i; }
        }

        uint256 lockedAmount = matchFee * players.length;

        fundLocks[matchDataHash] = lockedAmount;

        emit MatchStarted(matchDataHash, matchId, players, matchFee, lockedAmount);
    }

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

        uint256 lockedAmount = fundLocks[matchDataHash];
        if (lockedAmount == 0) revert InvalidMatchOrPayouts(matchId, matchDataHash);

        delete fundLocks[matchDataHash];

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

    function setFeeVault(address _feeVault) external override onlyAuthorized {
        if (_feeVault == address(0)) revert ZeroAddressPassed();

        feeVault = _feeVault;
        emit FeeVaultSet(_feeVault);
    }

    function getFeeVault() external override view returns (address) {
        return feeVault;
    }

    function canMatch(
        address[] calldata players,
        uint256 feeRequired
    ) external view override returns (
        address[] memory unfundedPlayers
    ) {
        unfundedPlayers = new address[](players.length);

        uint256 k;
        for (uint256 i = 0; i < players.length;) {
            if (!_isFunded(players[i], feeRequired)) {
                unfundedPlayers[k] = players[i];
                unchecked { ++k; }
            }

            unchecked { ++i; }
        }

        return unfundedPlayers;
    }

    function _isFunded(address player, uint256 feeRequired) internal view returns (bool) {
        return balances[player] >= feeRequired;
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
