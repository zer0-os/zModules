// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMigrationClaim } from "./IMigrationClaim.sol";


/**
 * @title Vault
 * @notice A contract to hold previously staked funds and allow eligible users to claim them
 * @author James Earle <https://github.com/JamesEarle>
 */
contract MigrationClaim is Ownable, IMigrationClaim {
    using SafeERC20 for IERC20;

    /**
     * @notice Root of the merkle tree with claim data
     */
    bytes32 public merkleRoot;

    /**
     * @notice Rewards vault containing user funds for transfer
     */
    address public rewardsVault;

    /**
     * @notice The WILD ERC20 Token
     */
    IERC20 public wildToken;

    /**
     * @notice The LP ERC20 Token, provided by Uniswap 
     */
    IERC20 public lpToken;

    /**
     * @notice Mapping to track users that have claimed
     */
    mapping(address => bool) public claimed;

    constructor(
        bytes32 _merkleRoot,
        address _owner,
        address _rewardsVault,
        IERC20 _wildToken,
        IERC20 _lpToken
    ) Ownable(_owner) {
        merkleRoot = _merkleRoot;
        rewardsVault = _rewardsVault;
        wildToken = _wildToken;
        lpToken = _lpToken;
    }

    /**
     * @notice Claim any owed WILD and LP token balance
     * 
     * @param proof The merkle tree proof 
     * @param wildAmount The amount of WILD the `msg.sender` is owed
     * @param lpAmount The amount of LP the `msg.sender` is owed
     */
    function claim(
        bytes32[] memory proof,
        uint256 wildAmount,
        uint256 lpAmount
    ) external {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, wildAmount, lpAmount))));

        if (!MerkleProof.verify(proof, merkleRoot, leaf)) {
            revert InvalidProof();
        }   
        
        // User's that have already claimed cannot claim again
        if (claimed[msg.sender]) {
            revert AlreadyClaimed();
        }

        // Mark user as claimed
        claimed[msg.sender] = true;

        if (wildAmount > 0) IERC20(wildToken).safeTransferFrom(
            rewardsVault,
            msg.sender,
            wildAmount
        );

        if (lpAmount > 0) IERC20(lpToken).safeTransferFrom(
            rewardsVault,
            msg.sender,
            lpAmount
        );

        emit Claimed(msg.sender, wildAmount, lpAmount);
    }

    /**
     * @notice Allow the owner to set a new merkle tree root
     * @param _merkleRoot The new merkle root
     */
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;

        emit MerkleRootSet(_merkleRoot);
    }
}