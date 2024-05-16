## StakingBase

**StakingBase**

A set of common elements that are used in any Staking contract

### stakers

```solidity
mapping(address => struct IStakingBase.Staker) stakers
```

Mapping of each staker to that staker's data in the `Staker` struct

### stakingToken

```solidity
address stakingToken
```

The staking token for this pool

### rewardsToken

```solidity
contract IERC20 rewardsToken
```

The rewards token for this pool

### rewardsPerPeriod

```solidity
uint256 rewardsPerPeriod
```

The rewards of the pool per period length

### periodLength

```solidity
uint256 periodLength
```

The length of a time period

### timeLockPeriod

```solidity
uint256 timeLockPeriod
```

The amount of time required to pass to be able to claim or unstake

### constructor

```solidity
constructor(address _stakingToken, contract IERC20 _rewardsToken, uint256 _rewardsPerPeriod, uint256 _periodLength, uint256 _timeLockPeriod, address contractOwner) public
```

### claim

```solidity
function claim() external
```

Claim rewards for the calling user based on their staked amount

### withdrawLeftoverRewards

```solidity
function withdrawLeftoverRewards() external
```

Emergency function for the contract owner to withdraw leftover rewards
in case of an abandoned contract.

Can only be called by the contract owner. Emits a `RewardFundingWithdrawal` event.

### getRemainingLockTime

```solidity
function getRemainingLockTime() external view returns (uint256)
```

Return the time, in seconds, remaining for a stake to be claimed or unstaked

### getPendingRewards

```solidity
function getPendingRewards() external view returns (uint256)
```

View the pending rewards balance for a user

### getContractRewardsBalance

```solidity
function getContractRewardsBalance() external view returns (uint256)
```

View the rewards balance in this pool

### _checkRewards

```solidity
function _checkRewards(struct IStakingBase.Staker staker) internal
```

### _baseClaim

```solidity
function _baseClaim(struct IStakingBase.Staker staker) internal
```

### _getPendingRewards

```solidity
function _getPendingRewards(struct IStakingBase.Staker staker) internal view returns (uint256)
```

### _getContractRewardsBalance

```solidity
function _getContractRewardsBalance() internal view returns (uint256)
```

### _onlyUnlocked

```solidity
function _onlyUnlocked(uint256 unlockTimestamp) internal view
```

