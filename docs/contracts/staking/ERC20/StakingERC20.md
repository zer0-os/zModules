## StakingERC20

**StakingERC20**

A staking contract for ERC20 tokens

### constructor

```solidity
constructor(address _stakingToken, contract IERC20 _rewardsToken, uint256 _rewardsPerPeriod, uint256 _periodLength, uint256 _timeLockPeriod, address contractOwner) public
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

Unstake some or all of a user's stake

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount to withdraw |
| exit | bool | If true, the user will unstake without claiming rewards (optional) |

