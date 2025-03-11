## Match

**Match contract**

Contract for managing matches for escrow funds between players.

### PERCENTAGE_BASIS

```solidity
uint256 PERCENTAGE_BASIS
```

### lockedFunds

```solidity
mapping(bytes32 => uint256) lockedFunds
```

Mapping from the hash of `MatchData` struct
 to the total amount of tokens locked in escrow for the match

### feeVault

```solidity
address feeVault
```

The address of the fee vault which gathers all the `gameFee`s
This is a BASE value, that can change depending on the presence of rounding errors
in the payout calculation. If rounding errors occur, the difference in total payout amount
and the locked amount will be added to the `gameFee` and sent to the `feeVault`

### gameFeePercentage

```solidity
uint256 gameFeePercentage
```

The percentage of the `matchFee` per match that is charged for hosting the match
by the game. Represented as parts of 10,000 (100% = 10,000)

### constructor

```solidity
constructor(address _token, address _feeVault, address _owner, address[] _operators, uint256 _gameFeePercentage) public
```

### startMatch

```solidity
function startMatch(uint256 matchId, address[] players, uint256 matchFee) external
```

Starts a match, charges the entry fee from each player's balance, creates and hashes `MatchData` struct,
 and locks the total amount of tokens in escrow for the match, saving the amount to `lockedFunds` mapping,
 mapped by `matchDataHash` as the key. Emits a `MatchStarted` event with all the data.

Can ONLY be called by an authorized account!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| matchId | uint256 | The ID of the match assigned by a game client or the operator of this contract |
| players | address[] | Array of player addresses participating in the match |
| matchFee | uint256 | The entry fee for each player |

### endMatch

```solidity
function endMatch(uint256 matchId, address[] players, uint256[] payouts, uint256 matchFee) external
```

Ends a match, creates and hashes a MatchData struct with the data provided, validates that
 funds have been locked for this match previously (same match has been started), validates that
 `payouts + gameFee` add up to the total locked funds, transfers the payouts to the players,
 and emits a `MatchEnded` event.

Can ONLY be called by an authorized account! Note that the `lockedFunds` mapping entry will be deleted
 for a gas refund, leaving historical data only in the event logs.
> It is important for the caller to calculate the payouts correctly,
since the contract validates the correctness of the amounts sent and will revert if they
do not add up exactly to the `lockedAmount` for the match.
If rounding errors occur in calculating payouts,
the difference between `payoutSum + gameFee` and `lockedAmount` should be added
to one of the payouts (probably a loser of the match)!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| matchId | uint256 | The ID of the match assigned by a game client or the operator of this contract |
| players | address[] | Array of player addresses (has to be the exact same array passed to `startMatch()`!) |
| payouts | uint256[] | The amount of tokens each player will receive (pass 0 for players with no payouts!)  Has to be the same length as `players`! |
| matchFee | uint256 | The entry fee for the match |

### setFeeVault

```solidity
function setFeeVault(address _feeVault) external
```

Sets the address of the fee vault where all the `gameFee`s go

Can ONLY be called by an authorized account!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _feeVault | address | The address of the new fee vault |

### setGameFeePercentage

```solidity
function setGameFeePercentage(uint256 _gameFeePercentage) external
```

Sets the percentage of the `matchFee` per match that is charged for hosting the match
by the game. Represented as parts of 10,000 (100% = 10,000)

Can ONLY be called by the OWNER!

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _gameFeePercentage | uint256 | The percentage value to set |

### _setGameFeePercentage

```solidity
function _setGameFeePercentage(uint256 _gameFeePercentage) internal
```

### _isFunded

```solidity
function _isFunded(address player, uint256 amountRequired) internal view returns (bool)
```

### _getMatchDataHash

```solidity
function _getMatchDataHash(uint256 matchId, uint256 matchFee, address[] players) internal pure returns (bytes32)
```

