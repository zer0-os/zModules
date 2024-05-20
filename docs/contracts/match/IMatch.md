## IMatch

struct MatchData
- matchId (uint256) - The ID of the match assigned by a game client or the operator of this contract
- matchFee (uint256) - The entry fee for the match
- players (address[]) - Array of player addresses participating in the match

### MatchData

```solidity
struct MatchData {
  uint256 matchId;
  uint256 matchFee;
  address[] players;
}
```

### FeeVaultSet

```solidity
event FeeVaultSet(address feeVault)
```

Emitted when the `feeVault` address is set in state, an address where all the `gameFee`s go

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeVault | address | The address of the fee vault |

### MatchStarted

```solidity
event MatchStarted(bytes32 matchDataHash, uint256 matchId, address[] players, uint256 matchFee, uint256 fundsLocked)
```

Emitted when a match is started by the contract operator/owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| matchDataHash | bytes32 | The hash of the MatchData struct (`keccak256(abi.encode(matchData))`) |
| matchId | uint256 | The ID of the match assigned by a game client or the operator of this contract |
| players | address[] | The array of player addresses participating in the match |
| matchFee | uint256 | The entry fee for the match |
| fundsLocked | uint256 | The total amount of tokens locked in escrow for the match (or `players.length * matchFee`)  this is also a value that is saved to state in `lockedFunds[matchDataHash]` |

### MatchEnded

```solidity
event MatchEnded(bytes32 matchDataHash, uint256 matchId, address[] players, uint256[] payouts, uint256 matchFee, uint256 gameFee)
```

Emitted when a match is ended by the contract operator/owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| matchDataHash | bytes32 | The hash of the MatchData struct (`keccak256(abi.encode(matchData))`) |
| matchId | uint256 | The ID of the match assigned by a game client or the operator of this contract |
| players | address[] | The array of player addresses participating in the match (same length as `payouts`!) |
| payouts | uint256[] | The amount of tokens each player will receive (same length as `players`!) |
| matchFee | uint256 | The entry fee for the match |
| gameFee | uint256 | The fee charged by the contract for hosting the match, will go to `feeVault` |

### InvalidMatchOrPayouts

```solidity
error InvalidMatchOrPayouts(uint256 matchId, bytes32 matchDataHash)
```

Reverted when the match data is incorrect or the payout amounts do not add up to `lockedFunds`
 from `startMatch()` calls

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| matchId | uint256 | The ID of the match assigned by a game client or the operator of this contract |
| matchDataHash | bytes32 | The hash of the MatchData struct (`keccak256(abi.encode(matchData))`) |

### MatchAlreadyStarted

```solidity
error MatchAlreadyStarted(uint256 matchId, bytes32 matchDataHash)
```

Reverted when a match is already started with the same `matchId` and `matchDataHash`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| matchId | uint256 | The ID of the match assigned by a game client or the operator of this contract |
| matchDataHash | bytes32 | The hash of the MatchData struct (`keccak256(abi.encode(matchData))`) |

### NoPlayersInMatch

```solidity
error NoPlayersInMatch(uint256 matchId)
```

Reverted when `players` array is passed as empty

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| matchId | uint256 | The ID of the match assigned by a game client or the operator of this contract |

### ArrayLengthMismatch

```solidity
error ArrayLengthMismatch()
```

Reverted when the length of `players` and `payouts` arrays are different

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
function endMatch(uint256 matchId, address[] players, uint256[] payouts, uint256 matchFee, uint256 gameFee) external
```

Ends a match, creates and hashes a MatchData struct with the data provided, validates that
 funds have been locked for this match previously (same match has been started), validates that
 `payouts + gameFee` add up to the total locked funds, transfers the payouts to the players,
 and emits a `MatchEnded` event.

Can ONLY be called by an authorized account! Please note that the `lockedFunds` mapping entry will be deleted
 for a gas refund, leaving historical data only in the event logs.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| matchId | uint256 | The ID of the match assigned by a game client or the operator of this contract |
| players | address[] | Array of player addresses (has to be the exact same array passed to `startMatch()`!) |
| payouts | uint256[] | The amount of tokens each player will receive (pass 0 for players with no payouts!)  Has to be the same length as `players`! |
| matchFee | uint256 | The entry fee for the match |
| gameFee | uint256 | The fee charged by the contract for hosting the match, will go to `feeVault` |

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

### getFeeVault

```solidity
function getFeeVault() external view returns (address)
```

Gets the address of the fee vault where all the `gameFee`s go

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | feeVault The address of the fee vault |

### canMatch

```solidity
function canMatch(address[] players, uint256 matchFee) external view returns (address[] unfundedPlayers)
```

Checks if all players have enough balance in escrow to participate in the match

Note that the returned array will always be the same length as `players` array, with valid players
 being `address(0)` in the same index as the player in the `players` array. If all players have enough balance
 in escrow, the returned array will be filled with 0x0 addresses.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| players | address[] | Array of player addresses |
| matchFee | uint256 | The required balance in escrow for each player to participate |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| unfundedPlayers | address[] | Array of player addresses who do not have enough balance in escrow |

