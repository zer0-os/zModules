// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol"; // Correct import is Ownable, not Owned
import {Escrow} from "../escrow/Escrow.sol";
import {IMatch} from "./IMatch.sol";


contract Match is Ownable, IMatch, Escrow {
    struct MatchData {
        uint id;
        uint startTime;
        uint endTime;
        address[] players;
    }

    mapping(uint => MatchData) public matches;
    uint nextMatchID;

    constructor(IERC20 token, address _owner, Escrow _escrow) Ownable(_owner) Escrow(token, _owner) {}

    function startMatch(address[] calldata players, uint entryFee) external override {
        require(canMatch(players))
        MatchData storage match = matches[nextMatchId];
        match.id = nextMatchId;
        match.startTime = block.timestamp;
        match.players = players;
        nextMatchId++;
        for(uint i = 0; i < players.length; i++) {
            executeCharge(players[i], entryFee);
        }
    }

    function endMatch(uint matchId, address[] calldata winners, uint winAmount) external override {
        require(matches[matchId].startTime != 0, "Match does not exist");
        matches[matchId].endTime = block.timestamp;
        for(uint i = 0; i < winners.length; i++) {
            executePayment(winners[i], winAmount);
        }   
    }

    function canMatch(address[] calldata players, uint escrowRequired) external override view returns(bool) {
        for(uint i = 0; i < players.length; i++) {
            if(balance[players[i]] < escrowRequired) {
                return false;
            }
        }
        return true;
    }

    function getMatchID(uint id) external view override returns (uint, uint, uint, address[] memory) {
        MatchData memory match = matches[id];
        return (match.id, match.startTime, match.endTime, match.players);
    }
}
