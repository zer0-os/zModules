## IEscrow

### Deposit

```solidity
event Deposit(address user, uint256 amount)
```

Emitted when tokens are deposited into the contract

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The address of the user who deposited the tokens |
| amount | uint256 | The amount of tokens deposited |

### Withdrawal

```solidity
event Withdrawal(address user, uint256 amount)
```

Emitted when tokens are withdrawn from the contract

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The address of the user who withdrew the tokens |
| amount | uint256 | The amount of tokens withdrawn |

### FundsReleased

```solidity
event FundsReleased(address user, uint256 amount)
```

Emitted when tokens are refunded to a user by the contract owner or operator

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The address of the user to whom the tokens were refunded |
| amount | uint256 | The amount of tokens refunded |

### InsufficientFunds

```solidity
error InsufficientFunds(address user)
```

Reverted when a user has insufficient funds in this Escrow for an operation

### AddressIsNotAContract

```solidity
error AddressIsNotAContract(address addr)
```

Reverted when the address passed is not a contract

### ZeroAmountPassed

```solidity
error ZeroAmountPassed()
```

Reverted when zero amount is passed to the function
 to avoid 0 transfers.

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

### releaseFunds

```solidity
function releaseFunds(address user, uint256 amount) external
```

Refunds tokens from the escrow back to a user by the contract owner or operator.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The address of the user to refund tokens to. |
| amount | uint256 | The amount of tokens to release for the user. |

