## StakingERC20

**StakingERC20**

A staking contract for ERC20 tokens

### stakers

```solidity
mapping(address => struct IStakingBase.Staker) stakers
```

Mapping of each staker to that staker's data in the `Staker` struct

### totalStaked

```solidity
uint256 totalStaked
```

Track the total amount staked in the pool

### constructor

```solidity
constructor(address _contractOwner, address _stakingToken, address _rewardsToken, address _stakeRepToken, struct IStakingBase.RewardConfig _config) public
```

### stakeWithLock

```solidity
function stakeWithLock(uint256 amount, uint256 lockDuration) external payable
```

Stake an amount of ERC20 with a lock period By locking,
a user cannot access their funds until the lock period is over, but they
receive a higher rewards rate for doing so

A user can call to `unstake` with `exit` as true to access their funds
before the lock period is over, but they will forfeit their rewards
This function and the below `stakeWithoutLock` are intentionally separate for clarity

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to stake |
| lockDuration | uint256 | The duration of the lock period |

### stakeWithoutLock

```solidity
function stakeWithoutLock(uint256 amount) external payable
```

Stake an amount of ERC20 with no lock period. By not locking, a
user can access their funds any time, but they forfeit a higher rewards rate

This function and the above`stakeWithLock` are intentionally separate for clarity

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to stake |

### claim

```solidity
function claim() external
```

Claim all of the user's rewards that are currently available

### unstakeUnlocked

```solidity
function unstakeUnlocked(uint256 amount) external
```

Unstake a specified amount of a user's non-locked stake

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to withdraw |

### unstakeLocked

```solidity
function unstakeLocked(uint256 amount) external
```

Unstake a specified amount of a user's locked funds that were locked

Will revert if funds are still within their lock period

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to withdraw |

### exit

```solidity
function exit(bool locked) external
```

### getRemainingLockTime

```solidity
function getRemainingLockTime() public view returns (uint256)
```

Return the time in seconds remaining for the staker's lock duration

### getPendingRewards

```solidity
function getPendingRewards() public view returns (uint256)
```

Return the amount of rewards a user is owed

### _stake

```solidity
function _stake(uint256 amount, uint256 lockDuration) internal
```

### _exit

```solidity
function _exit(bool locked) internal
```

### _unstakeUnlocked

```solidity
function _unstakeUnlocked(uint256 amount) internal
```

### _unstakeLocked

```solidity
function _unstakeLocked(uint256 amount) internal
```

### _getContractRewardsBalance

```solidity
function _getContractRewardsBalance() internal view returns (uint256)
```

If we just use `rewardsToken.balance` on the contract address when checking
funding it will be a misleading amount because it will also include the amount staked by users
To avoid this, we override the internal `_getContractRewardsBalance` function to
return the balance of the rewards token minus the total staked amount

