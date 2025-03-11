## ZeroVotingERC721

**ZeroVotingERC721**

Implementation of the ZeroVotingERC721 token made for voting in the zDAO.

This contract's code is general, but it was made to primarily be issued 1:1 by the StakingERC721 contract
 as a representative token for user's staked amount.
 This token is non-transferrable, and can only be minted and burned by the minter and burner roles,
 which should be assigned to the StakingERC721 contract only.
 After that it is also advisable to renounce the admin role to leave control of the token to the staking contract.

### MINTER_ROLE

```solidity
bytes32 MINTER_ROLE
```

### BURNER_ROLE

```solidity
bytes32 BURNER_ROLE
```

### __baseURI

```solidity
string __baseURI
```

Base URI used for ALL tokens. Can be empty if individual URIs are set.

### _totalSupply

```solidity
uint256 _totalSupply
```

Total supply of all tokens

### constructor

```solidity
constructor(string name, string symbol, string baseUri, string domainName, string domainVersion, address admin) public
```

Initializes the ERC721 token with a name, symbol.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | string | The name of the ERC721 token. |
| symbol | string | The symbol of the ERC721 token. |
| baseUri | string | The base URI for all tokens, can be empty if individual URIs are set. |
| domainName | string | The name of the EIP712 signing domain. |
| domainVersion | string | The version of the EIP712 signing domain. |
| admin | address | The address that will be granted the DEFAULT_ADMIN_ROLE which will be able to grant other roles,  specifically MINTER and BURNER. |

### mint

```solidity
function mint(address to, uint256 tokenId, string tokenUri) public
```

External mint function. Mints a new token to a specified address.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address that will receive the minted token. |
| tokenId | uint256 | The token ID for the newly minted token. |
| tokenUri | string | The URI for the newly minted token (optional if baseURI is used). |

### safeMint

```solidity
function safeMint(address to, uint256 tokenId, string tokenUri) public
```

Mints `tokenId`, transfers it to `to` and checks for `to` acceptance.
 External function for ERC721._safeMint.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address that will receive the minted token. |
| tokenId | uint256 | The token ID for the newly minted token. |
| tokenUri | string | The URI for the newly minted token (optional if baseURI is used). |

### burn

```solidity
function burn(uint256 tokenId) public
```

External burn function. Burns a token for a specified address.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID of the token to burn. |

### setBaseURI

```solidity
function setBaseURI(string baseUri) public
```

Function for setting `baseURI` used for all tokens in the collection.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| baseUri | string | The base URI for all tokens. |

### setTokenURI

```solidity
function setTokenURI(uint256 tokenId, string tokenUri) public
```

Function for setting the token URI for a specific token, contrary to using the `baseURI`.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID for the token to set the URI for. |
| tokenUri | string | The URI for the token. |

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

### baseURI

```solidity
function baseURI() public view returns (string)
```

### tokenURI

```solidity
function tokenURI(uint256 tokenId) public view returns (string)
```

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view virtual returns (bool)
```

### getInterfaceId

```solidity
function getInterfaceId() public pure returns (bytes4)
```

### _update

```solidity
function _update(address to, uint256 tokenId, address auth) internal returns (address)
```

Disallow all transfers, only `_mint` and `_burn` are allowed

### _increaseBalance

```solidity
function _increaseBalance(address account, uint128 amount) internal
```

### _baseURI

```solidity
function _baseURI() internal view returns (string)
```

Base URI for computing {tokenURI}. If set, the resulting URI for each
token will be the concatenation of the `baseURI` and the `tokenId`. Empty
by default, can be overridden in child contracts.

