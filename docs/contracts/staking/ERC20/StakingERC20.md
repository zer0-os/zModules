## StakingERC20

**StakingERC20**

A staking contract for ERC20 tokens

### constructor

```solidity
constructor(address _stakingToken, contract IERC20 _rewardsToken, uint256 _rewardsPerPeriod, uint256 _periodLength, uint256 _timeLockPeriod) public
```

### stake

```solidity
function stake(uint256 amount) external
```

Stake an amount of the ERC20 staking token specified

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to stake |

### unstake

```solidity
function unstake(uint256 amount, bool exit) external
```

