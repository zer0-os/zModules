## IOwnableOperable

### OperatorAdded

```solidity
event OperatorAdded(address operator)
```

Emitted when an operator is added to the contract by the owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The address of the new operator |

### OperatorRemoved

```solidity
event OperatorRemoved(address operator)
```

Emitted when an operator is removed from the contract by the owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The address of the operator to be removed |

### NotAuthorized

```solidity
error NotAuthorized(address caller)
```

Reverted when the caller is not the owner or an operator

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| caller | address | The address of the caller |

### ZeroAddressPassed

```solidity
error ZeroAddressPassed()
```

Reverted when the zero address is passed to the function

### addOperator

```solidity
function addOperator(address operator) external
```

Adds an operator to the contract. Only callable by the owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The address of the new operator |

### addOperators

```solidity
function addOperators(address[] _operators) external
```

Adds multiple operators to the contract. Only callable by the owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _operators | address[] | The array of operator addresses to add |

### removeOperator

```solidity
function removeOperator(address operator) external
```

Removes an operator from the contract. Only callable by the owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The address of the operator to remove |

### isOperator

```solidity
function isOperator(address operator) external view returns (bool)
```

Checks if an address is an operator

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The address to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool True if the address is an operator |

