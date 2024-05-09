// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMatch } from "./IMatch.sol";
import { Escrow } from "../escrow/Escrow.sol";


// TODO esc: find better naming
contract Match is IMatch, Escrow {
    // TODO esc: make sure we can actually read arrays in events !!!
    error PlayerWithInsufficientFunds(address player);

    // TODO esc: what else to add here ?
    struct MatchData {
        uint256 matchId;
        uint256 entryFee;
        address[] players;
    }

    mapping(bytes32 matchDataHash => uint256 amount) public fundLocks;

    // TODO esc: should we save match data here to make sure only mathces registered on this contract
    //  can be ended with payouts?
    //  Should this data be saved as hashes of structs that can be verified, to save on space?
    //  We could also just make these hashes and fire them in events. We shouldn't be able to
    //  end a match if a proper amount of tokens hasn't been locked ??

    // TODO esc: should the escrow be here as an external address saved vs money being store on this contract directly???
    //  this Escrow could be used in other contracts as well for other games.

    constructor(address _token, address _owner) Escrow(_token, _owner) {}

    // TODO esc: should we add funds release function here to avoid matches being stuck or some other issues???

    function canMatch(
        address[] calldata players,
        uint256 feeRequired
    ) external override view returns (
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
        uint256 entryFee
    ) external override {
        // TODO esc: do we need this check?
        require(players.length > 0, "No players");

        // TODO esc: make this better. possibly do all the logic in this contract
        for (uint256 i = 0; i < players.length; ) {
            if (!_isFunded(players[i], entryFee)) {
                revert PlayerWithInsufficientFunds(players[i]);
            }

            balances[players[i]] -= entryFee;

            unchecked { ++i; }
        }

        uint256 lockedAmount = entryFee * players.length;

        MatchData memory matchData = MatchData({
            matchId: matchId,
            entryFee: entryFee,
            players: players
        });

        bytes32 matchHash = keccak256(abi.encode(matchData));

        fundLocks[matchHash] = lockedAmount;

        // TODO esc: can we just create a has of a certain struct with match data and fire it here in the event
        //  instead of saving it in state? AND in MatchEnded event?
        emit MatchStarted(matchHash, matchId, players, entryFee, lockedAmount);
    }

    function endMatch(
        uint256 matchId,
    // TODO esc: why pass these if they are already saved? cause cheaper. why do we save them then?
        address[] calldata winners,
        uint256[] calldata winAmounts
    ) external override {
        require(winners.length == winAmounts.length, "Array lengths mismatch");

        // TODO esc: validate that the sum of `winAmounts` is equal to the amount locked
        //  for this race by startMatch.
        for (uint256 i = 0; i < winners.length; i++) {
            pay(winners[i], winAmounts[i]);
        }

        emit MatchEnded(block.timestamp, winners, winAmounts);
    }

    function _isFunded(address player, uint256 feeRequired) internal view returns (bool) {
        return balances[player] >= feeRequired;
    }
}
