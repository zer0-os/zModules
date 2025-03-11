## IStakingBase

**IStakingBase**

Interface for the base staking contract

### Staker

Struct to track an individual staker's data

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |

```solidity
struct Staker {
  uint256 unlockedTimestamp;
  uint256 amountStaked;
  uint256 amountStakedLocked;
  uint256 owedRewards;
  uint256 owedRewardsLocked;
  uint256 lastTimestamp;
  uint256 lastTimestampLocked;
}
```

### RewardConfig

Struct to hold all required config variables

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |

```solidity
struct RewardConfig {
  uint256 timestamp;
  uint256 rewardsPerPeriod;
  uint256 periodLength;
  uint256 minimumLockTime;
  uint256 minimumRewardsMultiplier;
  uint256 maximumRewardsMultiplier;
  bool canExit;
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
event Claimed(address claimer, uint256 rewards)
```

Emit when a user claims rewards

Because all contracts reward in ERC20 this can be shared

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| claimer | address | The address of the user claiming rewards |
| rewards | uint256 | The amount of rewards the user received |

### RewardConfigSet

```solidity
event RewardConfigSet(struct IStakingBase.RewardConfig rewardConfig)
```

Emit when the config is set

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardConfig | struct IStakingBase.RewardConfig | The incoming config |

### ZeroValue

```solidity
error ZeroValue()
```

Revert when the user tries to stake or unstake 0 tokens

### TimeLockNotPassed

```solidity
error TimeLockNotPassed()
```

Throw when the lock period has not passed

### ZeroRewards

```solidity
error ZeroRewards()
```

Throw when trying to claim but user has no rewards

### InsufficientContractBalance

```solidity
error InsufficientContractBalance()
```

Throw when the contract requires additional funding to
be able to match owed rewards

### LockTimeTooShort

```solidity
error LockTimeTooShort()
```

Throw when a staker tries to lock for less than
the minimum lock time

### InitializedWithZero

```solidity
error InitializedWithZero()
```

Throw when passing zero values to set a state var

### InvalidMultiplierPassed

```solidity
error InvalidMultiplierPassed()
```

Throw when passing a multiplier to set that is not within the bounds

### GasTokenTransferFailed

```solidity
error GasTokenTransferFailed()
```

Throw when the transfer of gas token fails

### CannotExit

```solidity
error CannotExit()
```

Throw when a call to exit is disallowed

### InvalidAddress

```solidity
error InvalidAddress()
```

Throw when incoming address is invalid

### LastConfigTooSoon

```solidity
error LastConfigTooSoon()
```

Throw when the last config was set too recently to call again

### CanNotAcceptNativeToken

```solidity
error CanNotAcceptNativeToken()
```

Throw when native (gas) token is sent to the contract
 via a regular transfer without calling a function
 in the case when the contract is not supposed to accept it

### receive

```solidity
receive() external payable
```

### withdrawLeftoverRewards

```solidity
function withdrawLeftoverRewards() external
```

### setRewardConfig

```solidity
function setRewardConfig(struct IStakingBase.RewardConfig _config) external
```

### getContractRewardsBalance

```solidity
function getContractRewardsBalance() external view returns (uint256)
```

### getStakeRewards

```solidity
function getStakeRewards(uint256 amount, uint256 timeDuration, bool locked) external view returns (uint256)
```

### getLatestConfig

```solidity
function getLatestConfig() external view returns (struct IStakingBase.RewardConfig)
```

### rewardConfigTimestamps

```solidity
function rewardConfigTimestamps(uint256 index) external view returns (uint256)
```

