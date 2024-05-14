// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMatch } from "./IMatch.sol";
import { Escrow } from "../escrow/Escrow.sol";


// TODO esc: find better naming
contract Match is Escrow, IMatch {

    mapping(bytes32 matchDataHash => uint256 amount) public fundLocks;

    address internal wilderWallet;

    // TODO esc: should we save match data here to make sure only mathces registered on this contract
    //  can be ended with payouts?
    //  Should this data be saved as hashes of structs that can be verified, to save on space?
    //  We could also just make these hashes and fire them in events. We shouldn't be able to
    //  end a match if a proper amount of tokens hasn't been locked ??

    // TODO esc: should the escrow be here as an external address saved vs money being store on this contract directly???
    //  this Escrow could be used in other contracts as well for other games.

    constructor(
        address _token,
        address _wilderWallet,
        address[] memory operators
    ) Escrow(_token, operators) {
        if (_wilderWallet == address(0)) revert ZeroAddressPassed();

        wilderWallet = _wilderWallet;
    }

    // TODO esc: should we add funds release function here to avoid matches being stuck or some other issues???

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

    // TODO esc: needs ACCESS CONTROL !!!
    function startMatch(
        uint256 matchId,
        address[] calldata players,
        uint256 matchFee
    ) external override onlyAuthorized {
        // TODO esc: do we need this check?
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
                revert PlayerWithInsufficientFunds(players[i]);
            }

            balances[players[i]] -= matchFee;

            unchecked { ++i; }
        }

        uint256 lockedAmount = matchFee * players.length;

        fundLocks[matchDataHash] = lockedAmount;

        // TODO esc: can we just create a has of a certain struct with match data and fire it here in the event
        //  instead of saving it in state? AND in MatchEnded event?
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

        // TODO esc: will there be a problem with rounding here or on the game side where these may not be exactly equal?
        if (payoutSum + gameFee != lockedAmount) revert InvalidMatchOrPayouts(matchId, matchDataHash);

        balances[wilderWallet] += gameFee;

        emit MatchEnded(
            matchDataHash,
            matchId,
            players,
            payouts,
            matchFee,
            gameFee
        );
    }

    function setWilderWallet(address _wilderWallet) external override onlyAuthorized {
        if (_wilderWallet == address(0)) revert ZeroAddressPassed();

        wilderWallet = _wilderWallet;
        emit WilderWalletSet(_wilderWallet);
    }

    function getWilderWallet() external override view returns (address) {
        return wilderWallet;
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

    function _isFunded(address player, uint256 feeRequired) internal view returns (bool) {
        return balances[player] >= feeRequired;
    }
}
