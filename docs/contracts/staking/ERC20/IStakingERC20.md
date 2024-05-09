## IStakingERC20


**IStakingERC20**

Interface for the ERC20 staking contract




### Staked

```solidity
event Staked(address staker, uint256 amount, address stakingToken)
```


Emit when a user stakes a token


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address | The address of the account which staked |
| amount | uint256 | The amount of the staked token |
| stakingToken | address | The address of the staking token contract |


### Unstaked

```solidity
event Unstaked(address staker, uint256 amount, address stakingToken)
```


Emit when a user unstakes


#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address |  |
| amount | uint256 | The amount of the staked token |
| stakingToken | address | The address of the staking token contract |


### UnstakeMoreThanStake

```solidity
error UnstakeMoreThanStake()
```


Revert when the user tries to unstake more than the initial stake amount




### ZeroStake

```solidity
error ZeroStake()
```


Revert when the user tries to stake 0 tokens




### stake

```solidity
function stake(uint256 amount) external
```







### unstake

```solidity
function unstake(uint256 amount, bool exit) external
```








