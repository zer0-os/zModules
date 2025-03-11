## IZeroVotingERC721

### BaseURIUpdated

```solidity
event BaseURIUpdated(string baseURI)
```

Emitted when the base URI is updated

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| baseURI | string | The new base URI |

### NonTransferrableToken

```solidity
error NonTransferrableToken()
```

### ZeroAddressPassed

```solidity
error ZeroAddressPassed()
```

### mint

```solidity
function mint(address to, uint256 tokenId, string tokenUri) external
```

### safeMint

```solidity
function safeMint(address to, uint256 tokenId, string tokenUri) external
```

### burn

```solidity
function burn(uint256 tokenId) external
```

### setBaseURI

```solidity
function setBaseURI(string baseUri) external
```

### setTokenURI

```solidity
function setTokenURI(uint256 tokenId, string tokenUri) external
```

### baseURI

```solidity
function baseURI() external view returns (string)
```

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

### tokenURI

```solidity
function tokenURI(uint256 tokenId) external view returns (string)
```

### getInterfaceId

```solidity
function getInterfaceId() external pure returns (bytes4)
```

