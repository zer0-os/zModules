// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMatch} from "./IMatch.sol";
import {Escrow} from "../escrow/Escrow.sol";

contract Match is IMatch, Escrow {
    error PlayersNotFunded(address[] players);

    struct MatchData {
        uint id;
        uint startTime;
        uint endTime;
        address[] players;
    }

    mapping(uint => MatchData) public matches;
    uint nextMatchId;

    constructor(IERC20 token, address _owner) Escrow(token, _owner) {}
    
    function canMatch(address[] calldata players, uint escrowRequired) public override view returns(bool) {
        address[] memory erroredPlayers = new address[](players.length);
        bool errored;

        for(uint i = 0; i < players.length; i++) {
            if(balance[players[i]] < escrowRequired) {
                erroredPlayers[i] = players[i];
                errored = true;
            }
        }
        if (errored){
            revert PlayersNotFunded(erroredPlayers);
        }

        return true;
    }

    function startMatch(address[] calldata players, uint entryFee) external override {
        require(players.length > 0, "No players");
        canMatch(players, entryFee);
        
        MatchData storage matchData = matches[nextMatchId];
        matchData.id = nextMatchId;
        matchData.startTime = block.timestamp;
        matchData.players = players;
        nextMatchId++;

        for(uint i = 0; i < players.length; i++) {
            charge(players[i], entryFee);
        }

        emit MatchStarted(nextMatchId, players, entryFee);
    }

    function endMatch(uint matchId, address[] calldata winners, uint[] calldata winAmounts) external override {
        require(matches[matchId].startTime != 0, "Match does not exist");
        require(winners.length == winAmounts.length, "Array lengths mismatch");

        matches[matchId].endTime = block.timestamp;

        for(uint i = 0; i < winners.length; i++) {
            pay(winners[i], winAmounts[i]);
        }   

        emit MatchEnded(matchId, block.timestamp, winners, winAmounts);
    }

    function getMatchData(uint id) external view override returns (uint, uint, uint, address[] memory) {
        MatchData memory matchData = matches[id];
        return (matchData.id, matchData.startTime, matchData.endTime, matchData.players);
    }
}
