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

    mapping(address => uint256) public claimed;

    event Claimed(address indexed user, uint256 amount);
    event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);

    constructor(
        address _owner,
        address _token
    )
        Ownable(_owner)
        Pausable()
        ReentrancyGuard() {
            require(_token != address(0), "Zero Rewards Vault: Token address cannot be zero");
            token = _token;
        }

    function setMerkleRoot(bytes32 _root) public onlyOwner {
        if (_root == bytes32(0)) {
            revert("Zero Rewards Vault: Merkle root cannot be zero");
        }

        _merkleRoot = _root;
        emit MerkleRootUpdated(_merkleRoot, _root);
    }

    function setToken(address _token) public onlyOwner {
        require(_token != address(0), "Zero Rewards Vault: Token address cannot be zero");
        token = _token;
    }

    function pause() external onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() external onlyOwner whenPaused{
        _unpause();
    }

    function claim(
        uint256 totalCumulativeRewards,
        bytes32[] calldata merkleProof
    ) public nonReentrant whenNotPaused {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, totalCumulativeRewards))));
        require(
            MerkleProof.verify(
                merkleProof,
                _merkleRoot,
                leaf
            ),
            "Zero Rewards Vault: Invalid proof"
        );

        uint256 amount = totalCumulativeRewards - claimed[msg.sender];
        require(amount > 0, "Zero Rewards Vault: No rewards to claim");

        claimed[msg.sender] += amount;
        totalClaimed += amount;

        IERC20(token).transfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }
}
