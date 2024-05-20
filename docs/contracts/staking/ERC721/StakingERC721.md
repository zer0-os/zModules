## StakingERC721

**Staking721**

A staking contract that allows depositing ERC721 tokens and mints a
non-transferable ERC721 token in return as representation of the deposit.

### baseURI

```solidity
string baseURI
```

Base URI used for ALL tokens. Can be empty if individual URIs are set.

### _totalSupply

```solidity
uint256 _totalSupply
```

Total supply of all tokens

### onlySNFTOwner

```solidity
modifier onlySNFTOwner(uint256 tokenId)
```

Revert if a call is not from the SNFT owner

### constructor

```solidity
constructor(string name, string symbol, string baseUri, address _stakingToken, contract IERC20 _rewardsToken, uint256 _rewardsPerPeriod, uint256 _periodLength, uint256 _timeLockPeriod) public
```

### stake

```solidity
function stake(uint256[] tokenIds, string[] tokenUris) external
```

Stake one or more ERC721 tokens and receive non-transferable ERC721 tokens in return

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | Array of tokenIds to be staked by the caller |
| tokenUris | string[] | (optional) Array of token URIs to be associated with the staked tokens. 0s if baseURI is used! |

### unstake

```solidity
function unstake(uint256[] tokenIds, bool exit) external
```

Unstake one or more ERC721 tokens

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | Array of tokenIds to be unstaked by the caller |
| exit | bool | Flag for if the user would like to exit without rewards |

### setBaseURI

```solidity
function setBaseURI(string baseUri) external
```

### setTokenURI

```solidity
function setTokenURI(uint256 tokenId, string tokenUri) external virtual
```

### getInterfaceId

```solidity
function getInterfaceId() external pure returns (bytes4)
```

### onERC721Received

```solidity
function onERC721Received(address, address, uint256, bytes) external pure returns (bytes4)
```

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

### tokenURI

```solidity
function tokenURI(uint256 tokenId) public view returns (string)
```

See {IERC721Metadata-tokenURI}.

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view virtual returns (bool)
```

See {IERC165-supportsInterface}

### _stake

```solidity
function _stake(uint256 tokenId, string tokenUri) internal
```

### _unstake

```solidity
function _unstake(uint256 tokenId) internal
```

### _safeMint

```solidity
function _safeMint(address to, uint256 tokenId, string tokenUri) internal
```

### _mint

```solidity
function _mint(address to, uint256 tokenId, string tokenUri) internal
```

### _burn

```solidity
function _burn(uint256 tokenId) internal
```

See {ERC721-_burn}. This override additionally checks to see if a
token-specific URI was set for the token, and if so, it deletes the token URI from
the storage mapping.

### _baseURI

```solidity
function _baseURI() internal view returns (string)
```

Base URI for computing {tokenURI}. If set, the resulting URI for each
token will be the concatenation of the `baseURI` and the `tokenId`. Empty
by default, can be overridden in child contracts.

### _beforeTokenTransfer

```solidity
function _beforeTokenTransfer(address from, address to, uint256, uint256) internal pure
```

Disallow all transfers, only `_mint` and `_burn` are allowed

