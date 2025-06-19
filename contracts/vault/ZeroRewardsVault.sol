// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";


contract ZeroRewardsVault is ReentrancyGuard, Pausable, Ownable {
    bytes32 public merkleRoot;
    IERC20 public rewardsVault;
    uint256 public totalClaimed;

    mapping(address => uint256) public claimed;

    event Claimed(address indexed user, uint256 amount);
    event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);
    event RewardsVaultSet(address indexed oldVault, address indexed newVault);

    constructor(
        bytes32 _root,
        address _rewardsVault
    ) Ownable(msg.sender)
    Pausable()
    ReentrancyGuard() {
        merkleRoot = _root;
        rewardsVault = IERC20(_rewardsVault);
    }

    function setRewardsVault(address _rewardsVault) external onlyOwner {
        rewardsVault = IERC20(_rewardsVault);
        emit RewardsVaultSet(address(rewardsVault), _rewardsVault);
    }

    function setMerkleRoot(bytes32 _root) public onlyOwner {
        if (_root == bytes32(0)) {
            revert("Zero Rewards Vault: Merkle root cannot be zero");
        }

        merkleRoot = _root;
        emit MerkleRootUpdated(merkleRoot, _root);
    }

    function setMerkleRootAndFundVault(
        bytes32 _root,
        uint256 amount
    ) public onlyOwner {
        require(amount > 0, "Zero Rewards Vault: Amount must be greater than zero");

        setMerkleRoot(_root);

        require(
            rewardsVault.transfer(address(this), amount),
            "Zero Rewards Vault: Transfer failed"
        );
    }

    function claim(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) public nonReentrant whenNotPaused {
        require(
            claimed[msg.sender] < amount,
            "Zero Rewards Vault: Accumulated rewards are less than the requested amount"
        );

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(
            MerkleProof.verify(
                merkleProof,
                merkleRoot,
                leaf
            ),
            "Zero Rewards Vault: Invalid proof"
        );

        claimed[msg.sender] = amount;
        rewardsVault.transfer(msg.sender, amount);
    }
    
    function verify(
        bytes32[] calldata proof,
        bytes32 hash
    ) internal view returns (bool) {
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (hash < proofElement) {
                hash = keccak256(abi.encodePacked(hash, proofElement));
            } else {
                hash = keccak256(abi.encodePacked(proofElement, hash));
            }
        }
        return hash == merkleRoot;
    }
}