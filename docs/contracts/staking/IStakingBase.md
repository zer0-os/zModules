## IStakingBase

**IStakingBase**

Interface for the base staking contract

### Staker

Struct to track a set of data for each staker

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |

```solidity
struct Staker {
  uint256 unlockTimestamp;
  uint256 owedRewards;
  uint256 lastUpdatedTimestamp;
  uint256 amountStaked;
}
```

### LeftoverRewardsWithdrawn

```solidity
event LeftoverRewardsWithdrawn(address owner, uint256 amount)
```

Emitted when the contract owner withdraws leftover rewards

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The address of the contract owner |
| amount | uint256 | The amount of rewards withdrawn |

### Claimed

```solidity
event Claimed(address claimer, uint256 rewards, address rewardsToken)
```

Emit when a user claims rewards

Because all contracts reward in ERC20 this can be shared

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| claimer | address | The address of the user claiming rewards |
| rewards | uint256 | The amount of rewards the user received |
| rewardsToken | address | The address of the rewards token contract |

### TimeLockNotPassed

```solidity
error TimeLockNotPassed()
```

Throw when the lock period has not passed

### NoRewardsLeftInContract

```solidity
error NoRewardsLeftInContract()
```

Throw when there are no rewards remaining in the pool
to give to stakers

### InitializedWithZero

```solidity
error InitializedWithZero()
```

Throw when passing zero values to set a state var

### claim

```solidity
function claim() external
```

### getRemainingLockTime

```solidity
function getRemainingLockTime() external returns (uint256)
```

### withdrawLeftoverRewards

```solidity
function withdrawLeftoverRewards() external
```

### getPendingRewards

```solidity
function getPendingRewards() external view returns (uint256)
```

### getContractRewardsBalance

```solidity
function getContractRewardsBalance() external view returns (uint256)
```

