## Escrow

**Escrow**

A simple general contract for holding tokens in escrow for multiple users

### token

```solidity
contract IERC20 token
```

Token contract operates on

### balances

```solidity
mapping(address => uint256) balances
```

Mapping of balances for every user of this escrow

### constructor

```solidity
constructor(address _token, address _owner, address[] _operators) public
```

### deposit

```solidity
function deposit(uint256 amount) external
```

Allows a user to deposit tokens into the escrow contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of tokens to deposit. |

### withdraw

```solidity
function withdraw(uint256 amount) external
```

Allows a user to withdraw funds from the escrow contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of tokens to withdraw. |

