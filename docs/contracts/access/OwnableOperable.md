## OwnableOperable

**OwnableOperable**

A contract that allows the owner to add and remove operators

### operators

```solidity
mapping(address => bool) operators
```

Mapping of operators to their status

### onlyAuthorized

```solidity
modifier onlyAuthorized()
```

### constructor

```solidity
constructor(address contractOwner) public
```

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

### addOperator

```solidity
function addOperator(address operator) public
```

Adds an operator to the contract. Only callable by the owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address | The address of the new operator |

### addOperators

```solidity
function addOperators(address[] _operators) public
```

Adds multiple operators to the contract. Only callable by the owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _operators | address[] | The array of operator addresses to add |

