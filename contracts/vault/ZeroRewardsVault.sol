// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract ZeroRewardsVault is Ownable {
    address public owner;
    bytes32 public merkleRoot;
    address public rewardsVault;

    mapping(address => uint256) public claimed;

    event Claimed(address indexed user, uint256 amount);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);
    event setRewardsVault(bytes32 indexed oldVault, bytes32 indexed newVault);

    constructor(
        bytes32 _root,
        address _rewardsVault
    ) Ownable(msg.sender) {
        merkleRoot = _root;
        rewardsVault = IERC20(_rewardsVault);
    }

    function setRewardsVault(address _rewardsVault) external onlyOwner {
        token = IERC20(_rewardsVault);
        emit setRewardsVault(rewardsVault, _rewardsVault);
    }

    function setMerkleRoot(bytes32 _root) external onlyOwner {
        if (_root == bytes32(0)) {
            revert("Zero Rewards Vault: Merkle root cannot be zero");
        }

        merkleRoot = _root;
        emit MerkleRootUpdated(merkleRoot, _root);
    }

    function setMerkleRootAndFundVault(
        bytes32 _root,
        uint256 amount
    ) external onlyOwner {
        require(amount > 0, "Zero Rewards Vault: Amount must be greater than zero");

        setMerkleRoot(_root);

        require(
            rewardsVault.transferFrom(msg.sender, address(this), amount),
            "Zero Rewards Vault: Transfer failed"
        );
    }

    function fundVault(
        address token,
        uint256 amount
    ) public {
        require(amount > 0, "Zero Rewards Vault: Amount must be greater than zero");
        require(
            token.transfer(address(this), amount),
            "Zero Rewards Vault: Transfer failed"
        );
    }

    function fundVaultFrom(
        address token,
        uint256 amount,
        address from
    ) external onlyOwner {
        require(amount > 0, "Zero Rewards Vault: Amount must be greater than zero");
        require(
            token.transferFrom(from, address(this), amount),
            "Zero Rewards Vault: Transfer failed"
        );
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

    function claim(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
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
        token.transfer(msg.sender, amount);
    }
}