// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";


contract ZeroVault {
    address public owner;
    bytes32 public merkleRoot;
    IERC20 public token;

    mapping(address => bool) public claimed;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    event Claimed(address indexed user, uint256 amount);
    // TODO: probably not needed
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    constructor(bytes32 _root, address _token) {
        owner = msg.sender;
        merkleRoot = _root;
        token = IERC20(_token);
    }

    function setMerkleRoot(bytes32 _root) external onlyOwner {
        merkleRoot = _root;
    }

    function setRewardToken(address _token) external onlyOwner {
        token = IERC20(_token);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero Vault: Zero address passed");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function verify(bytes32[] calldata proof, bytes32 hash) internal view returns (bool) {
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

    function claim(uint256 amount, bytes32[] calldata merkleProof) external {
        require(!claimed[msg.sender], "Already claimed");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(MerkleProof.verify(merkleProof, merkleRoot, leaf), "Invalid proof");

        claimed[msg.sender] = true;
        token.transfer(msg.sender, amount);
    }
}