## IStakingERC721

**IStakingERC721**

Interface for the StakingERC721 contract

### BaseURIUpdated

```solidity
event BaseURIUpdated(string baseURI)
```

Emitted when the base URI is updated

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| baseURI | string | The new base URI |

### Staked

```solidity
event Staked(address staker, uint256 tokenId, address stakingToken)
```

Emit when a user stakes a token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address | The address of the user staking |
| tokenId | uint256 | The token ID of the staked token |
| stakingToken | address | The address of the staking token contract |

### Unstaked

```solidity
event Unstaked(address staker, uint256 tokenId, address stakingToken)
```

Emit when a user unstakes

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address | The address of the user unstaking |
| tokenId | uint256 | The token ID of the staked token |
| stakingToken | address | The address of the staking token contract |

### InvalidOwner

```solidity
error InvalidOwner()
```

Throw when caller is not the sNFT owner

### NonTransferrableToken

```solidity
error NonTransferrableToken()
```

Throw when trying to transfer the representative sNFT

### stake

```solidity
function stake(uint256[] tokenIds, string[] tokenURIs) external
```

### unstake

```solidity
function unstake(uint256[] tokenIds, bool exit) external
```

### setBaseURI

```solidity
function setBaseURI(string baseUri) external
```

### setTokenURI

```solidity
function setTokenURI(uint256 tokenId, string tokenUri) external
```

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

### getInterfaceId

```solidity
function getInterfaceId() external pure returns (bytes4)
```

