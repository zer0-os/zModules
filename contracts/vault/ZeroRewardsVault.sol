// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IZeroRewardsVault } from "./IZeroRewardsVault.sol";


contract ZeroRewardsVault is ReentrancyGuard, Pausable, Ownable, IZeroRewardsVault {    
    bytes32 private _merkleRoot;
    uint256 public totalClaimed;
    address public token;

    mapping(address user => uint256 totalClaimed) public claimed;

    event Claimed(address indexed user, uint256 amount, bytes32[] merkleProof);
    event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);

    error ZeroMerkleRoot();
    error ZeroTokenAddress();
    error InvalidMerkleProof(bytes32[] merkleProof);
    error NoRewardsToClaim(address user);

    constructor(
        address _owner,
        address _token
    )
        Ownable(_owner)
        Pausable()
        ReentrancyGuard() {
            if (_token == address(0)) revert ZeroTokenAddress();
            token = _token;
        }

    function pause() external override onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() external override onlyOwner whenPaused{
        _unpause();
    }

    function setMerkleRoot(bytes32 _root) public override onlyOwner {
        if (_root == bytes32(0)) revert ZeroMerkleRoot();

        // TODO rew: Emit event before updating the root to allow for easier tracking
        // Or do we have to make a var for old root and emit the event after?
        emit MerkleRootUpdated(_merkleRoot, _root);
        _merkleRoot = _root;
    }

    function claim(
        uint256 totalCumulativeRewards,
        bytes32[] calldata merkleProof
    ) public override nonReentrant whenNotPaused {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, totalCumulativeRewards))));
        if (!MerkleProof.verify(
                merkleProof,
                _merkleRoot,
                leaf
            )
        ) revert InvalidMerkleProof(merkleProof);

        uint256 amount = totalCumulativeRewards - claimed[msg.sender];
        if (amount == 0) revert NoRewardsToClaim(msg.sender);

        claimed[msg.sender] += amount;
        totalClaimed += amount;

        IERC20(token).transfer(msg.sender, amount);
        emit Claimed(msg.sender, amount, merkleProof);
    }
}
