## IStakingERC20

**IStakingERC20**

Interface for the ERC20 staking contract

### Staked

```solidity
event Staked(address staker, uint256 amount, uint256 lockDuration)
```

Emit when a user stakes a token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address | The address of the account which staked |
| amount | uint256 | The amount of the staked token passed as an argument to the `stake()` |
| lockDuration | uint256 | The duration for which the stake is locked |

### Unstaked

```solidity
event Unstaked(address staker, uint256 amount)
```

Emit when a user unstakes

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address | The address of the account which unstaked |
| amount | uint256 | The amount of the staked token |

### Exited

```solidity
event Exited(address staker, uint256 amount, bool locked)
```

Emit when a users exits

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address | The address of the user exiting |
| amount | uint256 | The amount withdrawn |
| locked | bool | If the amount was locked |

### UnstakeMoreThanStake

```solidity
error UnstakeMoreThanStake()
```

Revert when the user tries to unstake more than the initial stake amount

### InsufficientValue

```solidity
error InsufficientValue()
```

Revert when the user is staking an amount inequal to the amount given

### NonZeroMsgValue

```solidity
error NonZeroMsgValue()
```

Revert when the user is sending gas token with ERC20 stake

### stakeWithLock

```solidity
function stakeWithLock(uint256 amount, uint256 lockDuration) external payable
```

### stakeWithoutLock

```solidity
function stakeWithoutLock(uint256 amount) external payable
```

### claim

```solidity
function claim() external
```

### unstakeUnlocked

```solidity
function unstakeUnlocked(uint256 amount) external
```

### unstakeLocked

```solidity
function unstakeLocked(uint256 amount) external
```

### exit

```solidity
function exit(bool locked) external
```

### getRemainingLockTime

```solidity
function getRemainingLockTime() external view returns (uint256)
```

### getPendingRewards

```solidity
function getPendingRewards() external view returns (uint256)
```

