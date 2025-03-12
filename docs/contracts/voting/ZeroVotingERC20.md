## ZeroVotingERC20

**ZeroVotingERC20**

Implementation of the ZeroVotingERC20 token made for voting in the zDAO.

This contract's code is general, but it was made to primarily be issued 1:1 by the StakingERC20 contract
 as a representative token for user's staked amount.
 This token is non-transferrable, and can only be minted and burned by the minter and burner roles,
 which should be assigned to the StakingERC20 contract only.
 After that it is also advisable to renounce the admin role to leave control of the token to the staking contract.

### MINTER_ROLE

```solidity
bytes32 MINTER_ROLE
```

### BURNER_ROLE

```solidity
bytes32 BURNER_ROLE
```

### constructor

```solidity
constructor(string name, string symbol, string domainName, string domainVersion, address admin) public
```

Initializes the token with name and symbol, also sets up ownership.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | string | The name of the ERC20 token. |
| symbol | string | The symbol of the ERC20 token. |
| domainName | string | The name of the EIP712 signing domain. |
| domainVersion | string | The version of the EIP712 signing domain. |
| admin | address | The address that will be granted the DEFAULT_ADMIN_ROLE which will be able to grant other roles,  specifically MINTER and BURNER. |

### mint

```solidity
function mint(address account, uint256 value) external
```

External mint function. Mints a specified amount of tokens to a specified account.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The address that will receive the minted tokens. |
| value | uint256 | The amount of tokens to mint to the specified account. |

### burn

```solidity
function burn(address account, uint256 amount) external
```

External burn function. Burns a specified amount of tokens from the sender's account.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | Account where tokens need to be burned. |
| amount | uint256 | The amount of tokens to burn. |

### nonces

```solidity
function nonces(address owner) public view returns (uint256)
```

Returns the current nonce for `owner`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | Address to query the nonce of. |

### _update

```solidity
function _update(address from, address to, uint256 value) internal
```

Disallow all transfers, only `_mint` and `_burn` are allowed

