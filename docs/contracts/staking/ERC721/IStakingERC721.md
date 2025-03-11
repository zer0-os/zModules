## IStakingERC721

**IStakingERC721**

Interface for the StakingERC721 contract

### NFTStaker

Struct to track ERC721 specific data for a staker

```solidity
struct NFTStaker {
  struct IStakingBase.Staker stake;
  mapping(uint256 => bool) locked;
}
```

### Staked

```solidity
event Staked(address staker, uint256 tokenId)
```

Emit when a user stakes a token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address | The address of the user staking |
| tokenId | uint256 | The token ID of the staked token |

### Unstaked

```solidity
event Unstaked(address staker, uint256 tokenId)
```

Emit when a user unstakes

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address | The address of the user unstaking |
| tokenId | uint256 | The token ID of the staked token |

### Exited

```solidity
event Exited(address staker, uint256[] tokenIds, bool locked)
```

Emit when a user exits with either locked or non locked funds

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address | The address of the user exiting |
| tokenIds | uint256[] | The tokens being removed |
| locked | bool | If the user exited with locked funds or not |

### InvalidOwner

```solidity
error InvalidOwner()
```

Throw when caller is not the sNFT owner

### InvalidOwnerOrStake

```solidity
error InvalidOwnerOrStake()
```

Throw when unstaking and caller is not owner of a token or tokenId is not staked

### InvalidUnstake

```solidity
error InvalidUnstake()
```

Throw when call to unstake makes no changes or is otherwise invalid

### NonTransferrableToken

```solidity
error NonTransferrableToken()
```

Throw when trying to transfer the representative sNFT

### NotFullExit

```solidity
error NotFullExit()
```

Throw when the user tries to exit the pool without their full staked amount

### stakeWithLock

```solidity
function stakeWithLock(uint256[] tokenIds, string[] tokenUris, uint256 lockDuration) external
```

### stakeWithoutLock

```solidity
function stakeWithoutLock(uint256[] tokenIds, string[] tokenURIs) external
```

### claim

```solidity
function claim() external
```

### unstakeUnlocked

```solidity
function unstakeUnlocked(uint256[] tokenIds) external
```

### unstakeLocked

```solidity
function unstakeLocked(uint256[] tokenIds) external
```

### exit

```solidity
function exit(uint256[] tokenIds, bool locked) external
```

### isLocked

```solidity
function isLocked(uint256 tokenId) external view returns (bool)
```

### getPendingRewards

```solidity
function getPendingRewards() external view returns (uint256)
```

### getRemainingLockTime

```solidity
function getRemainingLockTime() external view returns (uint256)
```

