## ZDAO

**ZDAO**

A customizable governance contract based on OpenZeppelin's Governor contracts.

Extends OpenZeppelin's Governor contracts with various extensions for governance settings,
voting, timelock control, and quorum fraction.
See OpenZeppelin documentation: https://docs.openzeppelin.com/contracts/4.x/api/governance
This is a fork of https://github.com/zer0-os/zDAO/blob/main/contracts/ZDAO.sol
With updated parent contracts and Solidity version.

### constructor

```solidity
constructor(string governorName, contract IVotes token, contract TimelockController timelock, uint48 delay_, uint32 votingPeriod_, uint256 proposalThreshold_, uint256 quorumPercentage_, uint48 voteExtension_) public
```

Creates a new ZDAO governance contract.

Initializes the governor with settings and extensions.
See OpenZeppelin Governor documentation: https://docs.openzeppelin.com/contracts/4.x/api/governance

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| governorName | string | The name of the governor instance. |
| token | contract IVotes | The governance token that allows users to vote. |
| timelock | contract TimelockController | The timelock controller that handles proposal execution delay. |
| delay_ | uint48 | The delay before voting starts (in blocks). |
| votingPeriod_ | uint32 | The duration of the voting period (in blocks). |
| proposalThreshold_ | uint256 | The minimum number of votes required to create a proposal. |
| quorumPercentage_ | uint256 | The quorum fraction required for a proposal to pass. |
| voteExtension_ | uint48 | The time in either number of blocks that is required to pass  since the moment a proposal reaches quorum until its voting period ends |

### votingDelay

```solidity
function votingDelay() public view returns (uint256)
```

### votingPeriod

```solidity
function votingPeriod() public view returns (uint256)
```

### proposalThreshold

```solidity
function proposalThreshold() public view returns (uint256)
```

### quorum

```solidity
function quorum(uint256 blockNumber) public view returns (uint256)
```

### state

```solidity
function state(uint256 proposalId) public view returns (enum IGovernor.ProposalState)
```

### proposalNeedsQueuing

```solidity
function proposalNeedsQueuing(uint256 proposalId) public view returns (bool)
```

### proposalDeadline

```solidity
function proposalDeadline(uint256 proposalId) public view returns (uint256)
```

Returns the proposal deadline in blocks.

Overrides the function from Governor and GovernorPreventLateQuorum.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| proposalId | uint256 | The ID of the proposal. |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view returns (bool)
```

See {IERC165-supportsInterface}.

### _queueOperations

```solidity
function _queueOperations(uint256 proposalId, address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) internal returns (uint48)
```

### _executeOperations

```solidity
function _executeOperations(uint256 proposalId, address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) internal
```

### _cancel

```solidity
function _cancel(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) internal returns (uint256)
```

### _castVote

```solidity
function _castVote(uint256 proposalId, address account, uint8 support, string reason, bytes params) internal returns (uint256)
```

### _executor

```solidity
function _executor() internal view returns (address)
```

