// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import { IMatch } from "./IMatch.sol";
import { Escrow } from "../escrow/Escrow.sol";


/**
 * @title Match contract
 * @notice Contract for managing matches for escrow funds between players.
 * @author Kirill Korchagin <https://github.com/Whytecrowe>, Damien Burbine <https://github.com/durienb>
 */
contract Match is Escrow, IMatch {
    uint256 public constant PERCENTAGE_BASIS = 10000;

    /**
     * @notice Mapping from the hash of `MatchData` struct
     *  to the total amount of tokens locked in escrow for the match
     */
    mapping(bytes32 matchDataHash => uint256 amount) public lockedFunds;

    /**
     * @notice The address of the fee vault which gathers all the `gameFee`s
     * This is a BASE value, that can change depending on the presence of rounding errors
     * in the payout calculation. If rounding errors occur, the difference in total payout amount
     * and the locked amount will be added to the `gameFee` and sent to the `feeVault`
     */
    address public feeVault;

    /**
     * @notice The percentage of the `matchFee` per match that is charged for hosting the match
     * by the game. Represented as parts of 10,000 (100% = 10,000)
     */
    uint256 public gameFeePercentage;

    constructor(
        address _token,
        address _feeVault,
        address _owner,
        address[] memory _operators,
        uint256 _gameFeePercentage
    ) Escrow(_token, _owner, _operators) {
        if (_feeVault == address(0)) revert ZeroAddressPassed();

        feeVault = _feeVault;

        _setGameFeePercentage(_gameFeePercentage);
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
        // matchFee can not be 0, otherwise the `lockedFunds` will be 0 and it won't be possible to `endMatch()`
        if (matchFee == 0) revert ZeroMatchFee(matchId);

        bytes32 matchDataHash = _getMatchDataHash(
            matchId,
            matchFee,
            players
        );

        if (lockedFunds[matchDataHash] != 0)
            revert MatchAlreadyStarted(matchId, matchDataHash);

        for (uint256 i = 0; i < players.length; ++i) {
            if (!_isFunded(players[i], matchFee)) {
                revert InsufficientFunds(players[i]);
            }

            balances[players[i]] -= matchFee;
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
     * > It is important for the caller to calculate the payouts correctly,
     * since the contract validates the correctness of the amounts sent and will revert if they
     * do not add up exactly to the `lockedAmount` for the match.
     * If rounding errors occur in calculating payouts,
     * the difference between `payoutSum + gameFee` and `lockedAmount` should be added
     * to one of the payouts (probably a loser of the match)!
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
    ) external override onlyAuthorized {
        if (players.length != payouts.length) revert ArrayLengthMismatch();

        bytes32 matchDataHash = _getMatchDataHash(
            matchId,
            matchFee,
            players
        );

        uint256 lockedAmount = lockedFunds[matchDataHash];
        if (lockedAmount == 0)
            revert InvalidMatchOrMatchData(matchId, matchDataHash);

        delete lockedFunds[matchDataHash];

        uint256 payoutSum;
        for (uint256 i = 0; i < players.length; ++i) {
            balances[players[i]] += payouts[i];
            payoutSum += payouts[i];
        }

        uint256 gameFee = (matchFee * gameFeePercentage) / PERCENTAGE_BASIS;

        if (payoutSum + gameFee != lockedAmount)
            revert InvalidPayouts(matchId);

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
     * @notice Sets the percentage of the `matchFee` per match that is charged for hosting the match
     * by the game. Represented as parts of 10,000 (100% = 10,000)
     * @dev Can ONLY be called by the OWNER!
     * @param _gameFeePercentage The percentage value to set
     */
    function setGameFeePercentage(uint256 _gameFeePercentage) external override onlyOwner {
        _setGameFeePercentage(_gameFeePercentage);
    }

    function _setGameFeePercentage(uint256 _gameFeePercentage) internal {
        if (_gameFeePercentage > PERCENTAGE_BASIS) revert InvalidPercentageValue(_gameFeePercentage);

        gameFeePercentage = _gameFeePercentage;
        emit GameFeePercentageSet(_gameFeePercentage);
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
