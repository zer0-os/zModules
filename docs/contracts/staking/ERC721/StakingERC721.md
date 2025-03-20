## StakingERC721

**Staking721**

A staking contract that allows depositing ERC721 tokens and mints a
non-transferable ERC721 token in return as representation of the deposit.

### nftStakers

```solidity
mapping(address => struct IStakingERC721.NFTStaker) nftStakers
```

Mapping that includes ERC721 specific data for each staker

### onlySNFTOwner

```solidity
modifier onlySNFTOwner(uint256 tokenId)
```

Revert if a call is not from the SNFT owner

### constructor

```solidity
constructor(address _contractOwner, address _stakingToken, address _rewardsToken, address _stakeRepToken, struct IStakingBase.RewardConfig _config) public
```

### stakeWithLock

```solidity
function stakeWithLock(uint256[] tokenIds, string[] tokenUris, uint256 lockDuration) external
```

Stake one or more ERC721 tokens with a lock period

These functions are separate intentionally for the sake of user clarity

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | The id(s) of the tokens to stake |
| tokenUris | string[] | The associated metadata URIs of the tokens to stake |
| lockDuration | uint256 | The lock durations, in seconds, for each token |

### stakeWithoutLock

```solidity
function stakeWithoutLock(uint256[] tokenIds, string[] tokenUris) external
```

Stake one or more ERC721 tokens without a lock period

These functions are separate intentionally for the sake of user clarity

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | Array of tokenIds to be staked by the caller |
| tokenUris | string[] | (optional) Array of token URIs to be associated with the staked tokens. 0s if baseURI is used! |

### claim

```solidity
function claim() external
```

Claim rewards for the calling user based on their staked amount

### unstakeUnlocked

```solidity
function unstakeUnlocked(uint256[] _tokenIds) external
```

Unstake tokens that were not locked

Will revert if the incoming array contains tokens that were locked
OPTIMIZATION: make unstake flow more manageable by separating functionality

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _tokenIds | uint256[] | Array of tokens to unstake |

### unstakeLocked

```solidity
function unstakeLocked(uint256[] _tokenIds) external
```

Unstake tokens that were locked and are now passed their lock period

Will revert if the incoming array contains tokens that were never locked
OPTIMIZATION: make unstake flow more manageable by separating functionality

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _tokenIds | uint256[] | Array of tokens to unstake |

### exit

```solidity
function exit(uint256[] _tokenIds, bool _locked) external
```

Withdraw locked or unlocked staked funds receiving no rewards

OPTIMIZATION: make unstake flow more manageable by separating functionality

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _tokenIds | uint256[] | Array of token IDs to withdraw |
| _locked | bool | Indicates whether to withdraw locked or non-locked funds |

### getRemainingLockTime

```solidity
function getRemainingLockTime() public view returns (uint256)
```

Return the time in seconds remaining for the staker's lock duration

### getPendingRewards

```solidity
function getPendingRewards() public view returns (uint256)
```

Get the total pending rewards for the caller

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The amount of rewards the caller has pending |

### isLocked

```solidity
function isLocked(uint256 tokenId) public view returns (bool)
```

Check if a token is locked

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The token ID to check |

### onERC721Received

```solidity
function onERC721Received(address, address, uint256, bytes) public pure returns (bytes4)
```

### _stake

```solidity
function _stake(uint256[] tokenIds, string[] tokenUris, uint256 lockDuration) internal
```

The ERC721 specific stake function, called by both `stakeWithLock` and `stakeWithoutLock`

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIds | uint256[] | Array of tokenIds to be staked by the caller |
| tokenUris | string[] | Array of token URIs to be associated with the staked tokens |
| lockDuration | uint256 | The lock duration for the staked tokens |

### _unstakeLocked

```solidity
function _unstakeLocked(uint256[] tokenIds) internal
```

### _unstakeUnlocked

```solidity
function _unstakeUnlocked(uint256[] _tokenIds) internal
```

### _exit

```solidity
function _exit(uint256[] _tokenIds, bool _locked) internal
```

### _coreUnstake

```solidity
function _coreUnstake(uint256 tokenId) internal
```

