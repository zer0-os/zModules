## StakingBase

**StakingBase**

A set of common elements that are used in any Staking contract

### PRECISION_DIVISOR

```solidity
uint256 PRECISION_DIVISOR
```

### LOCKED_PRECISION_DIVISOR

```solidity
uint256 LOCKED_PRECISION_DIVISOR
```

### stakingToken

```solidity
address stakingToken
```

The address of the staking token

### rewardsToken

```solidity
address rewardsToken
```

The address of the rewards token

### stakeRepToken

```solidity
address stakeRepToken
```

The address of the representative token minted with each stake

### rewardConfigTimestamps

```solidity
uint256[] rewardConfigTimestamps
```

List of timestamps that mark when a config was set

### rewardConfigs

```solidity
mapping(uint256 => struct IStakingBase.RewardConfig) rewardConfigs
```

Struct to hold each config we've used and when it was implemented

### constructor

```solidity
constructor(address _contractOwner, address _stakingToken, address _rewardsToken, address _stakeRepToken, struct IStakingBase.RewardConfig _rewardConfig) public
```

### receive

```solidity
receive() external payable
```

### setRewardConfig

```solidity
function setRewardConfig(struct IStakingBase.RewardConfig _config) external
```

Set the config for the staking contract

Setting a value to the value it already is will not add extra gas
so it is cheaper to set the entire config than to have individual setters

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _config | struct IStakingBase.RewardConfig | The incoming reward config |

### withdrawLeftoverRewards

```solidity
function withdrawLeftoverRewards() public
```

Emergency function for the contract owner to withdraw leftover rewards
in case of an abandoned contract.

Can only be called by the contract owner. Emits a `RewardFundingWithdrawal` event.

### getStakeRewards

```solidity
function getStakeRewards(uint256 timeOrDuration, uint256 amount, bool locked) public view returns (uint256)
```

Return the potential rewards that would be earned for a given stake

When `locked` is true, `timeOrDuration is a the duration of the lock period
When `locked` is false, `timeOrDuration` is a past timestamp of the most recent action

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| timeOrDuration | uint256 | The the amount of time given funds are staked, provide the lock duration if locking |
| amount | uint256 | The amount of the staking token to calculate rewards for |
| locked | bool | Boolean if the stake is locked |

### getContractRewardsBalance

```solidity
function getContractRewardsBalance() public view returns (uint256)
```

View the rewards balance in this pool

### getLatestConfig

```solidity
function getLatestConfig() public view returns (struct IStakingBase.RewardConfig)
```

### _coreStake

```solidity
function _coreStake(struct IStakingBase.Staker staker, uint256 amount, uint256 lockDuration) internal
```

Core stake functionality used by both StakingERC20 and StakingERC721

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | struct IStakingBase.Staker | The user that is staking |
| amount | uint256 | The amount to stake |
| lockDuration | uint256 | The duration to lock the stake for, in seconds |

### _coreClaim

```solidity
function _coreClaim(struct IStakingBase.Staker staker) internal
```

Core claim functionality used by both StakingERC20 and StakingERC721

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | struct IStakingBase.Staker | The staker to claim rewards for |

### _transferAmount

```solidity
function _transferAmount(address token, uint256 amount) internal
```

Transfer funds to a recipient after deciding whether to use
native or ERC20 tokens

We give `token` as an argument here because in ERC721 it is always the
reward token to transfer, but in ERC20 it could be either staking or rewards
token and we won't know which to check.

### _setRewardConfig

```solidity
function _setRewardConfig(struct IStakingBase.RewardConfig _config) internal
```

### _getRemainingLockTime

```solidity
function _getRemainingLockTime(struct IStakingBase.Staker staker) internal view returns (uint256)
```

Calculate the time remaining for a staker's lock. Return 0 if no locked funds or if passed lock time

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | struct IStakingBase.Staker | The staker to get the lock time for |

### _getStakeRewards

```solidity
function _getStakeRewards(uint256 timeOrDuration, uint256 amount, uint256 rewardsMultiplier, bool locked) internal view returns (uint256)
```

When `locked` is true, `timeOrDuration` is the lock period
When `locked` is false, `timeOrDuration` is the timestamp of the last action

### _getPendingRewards

```solidity
function _getPendingRewards(struct IStakingBase.Staker staker) internal view returns (uint256)
```

Get the total rewards owed to a staker

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | struct IStakingBase.Staker | The staker to get rewards for |

### _mostRecentTimestamp

```solidity
function _mostRecentTimestamp(struct IStakingBase.Staker staker) internal view returns (uint256)
```

Get the most recent timestamp for a staker

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | struct IStakingBase.Staker | The staker to get the most recent timestamp for |

### _calcRewardsMultiplier

```solidity
function _calcRewardsMultiplier(uint256 lock) internal view returns (uint256)
```

Locked rewards receive a multiplier based on the length of the lock
Because we precalc when user is staking, getting the latest config is okay

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| lock | uint256 | The length of the lock in seconds |

### _getContractRewardsBalance

```solidity
function _getContractRewardsBalance() internal view virtual returns (uint256)
```

Get the rewards balance of this contract

### _getLatestConfig

```solidity
function _getLatestConfig() internal view returns (struct IStakingBase.RewardConfig)
```

