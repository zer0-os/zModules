// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMatch } from "./IMatch.sol";
import { Escrow } from "../escrow/Escrow.sol";


contract Match is IMatch, Escrow {
    error PlayersWithInsufficientFunds(address[] players);

    // TODO esc: should the escrow be here as an external address saved vs money being store on this contract directly???
    //  this Escrow could be used in other contracts as well for other games.

    // TODO esc: will changing these to uint64 actually help?
    //  Do we actually need to save this data if we have it all in the events?
    struct MatchData {
        uint256 id; // TODO esc: this is doubled with the key in the mapping
        uint256 startTime;
        uint256 endTime;
        address[] players;
        // TODO esc: should we add payouts here as well?
    }

    // TODO esc: should we save hashes of this data instead of the data itself to save on gas?
    mapping(uint256 => MatchData) public matches;
    uint256 nextMatchId;

    constructor(address _token, address _owner) Escrow(_token, _owner) {}

    // TODO esc: should we make it a single player check, otherwise we will have 2 loops in startMatch
    // TODO esc: maybe it should be a separate internal function that we use in startMatch and here
    function canMatch(address[] calldata players, uint256 feeRequired) public override view {
        address[] memory erroredPlayers = new address[](players.length);
        bool errored;

        for (uint256 i = 0; i < players.length;) {
            if (balances[players[i]] < feeRequired) {
                erroredPlayers[i] = players[i];
                errored = true;
            }

            unchecked { ++i; }
        }

        if (errored) {
            revert PlayersWithInsufficientFunds(erroredPlayers);
        }
    }

    // TODO esc: needs ACCESS CONTROL !!!
    function startMatch(address[] calldata players, uint256 entryFee) external override {
        require(players.length > 0, "No players");
        // TODO esc: refactor this to not require a second loop
        canMatch(players, entryFee);

        MatchData storage matchData = matches[nextMatchId];
        matchData.id = nextMatchId;
        matchData.startTime = block.timestamp;
        matchData.players = players;
        nextMatchId++;

        // TODO esc: make this better. possibly do all the logic in this contract
        for (uint256 i = 0; i < players.length; i++) {
            // TODO esc: add a state var that would save the amount of tokens locked during the race,
            //  so we avoid situations of locked tokens if game bugs out
            //  is this necessary??
            charge(players[i], entryFee);
        }

        // TODO esc: fix incorrect nextMatchId
        emit MatchStarted(nextMatchId, players, entryFee);
    }

    function endMatch(
        uint256 matchId,
    // TODO esc: why pass these if they are already saved? cause cheaper. why do we save them then?
        address[] calldata winners,
        uint256[] calldata winAmounts
    ) external override {
        // TODO esc: is this necessary?
        require(matches[matchId].startTime != 0, "Match does not exist");
        require(winners.length == winAmounts.length, "Array lengths mismatch");

        // TODO esc: is MatchEnded timestamp not enough for us?
        matches[matchId].endTime = block.timestamp;

        for (uint256 i = 0; i < winners.length; i++) {
            pay(winners[i], winAmounts[i]);
        }

        emit MatchEnded(matchId, block.timestamp, winners, winAmounts);
    }

    // TODO esc: this is not needed cause our mapping is public
    function getMatchData(uint256 id) external view override returns (uint256, uint256, uint256, address[] memory) {
        MatchData memory matchData = matches[id];
        return (matchData.id, matchData.startTime, matchData.endTime, matchData.players);
    }
}
