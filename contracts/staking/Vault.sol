// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVault } from "./IVault.sol";

/**
 * @title Vault
 * @notice A contract to hold previously staked funds and allow eligible users to claim them
 * @author James Earle <https://github.com/JamesEarle>
 */
contract Vault is Ownable, IVault {
    using SafeERC20 for IERC20;

    bytes32 public merkleRoot;
    IERC20 public rewardToken;
    IERC20 public lpToken;

    mapping(address => bool) public claimed;

    constructor(
        address _owner,
        bytes32 _merkleRoot,
        IERC20 _rewardToken,
        IERC20 _lpToken
    ) Ownable(_owner) {
        merkleRoot = _merkleRoot;
        rewardToken = _rewardToken;
        lpToken = _lpToken;
    }

    function claim(
        bytes32[] memory proof,
        uint256 wildAmount,
        uint256 lpAmount
    ) external {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, wildAmount, lpAmount))));

        if (!MerkleProof.verify(proof, merkleRoot, leaf)) {
            revert InvalidProof();
        }   

        // Mark user as claimed
        if (claimed[msg.sender]) {
            revert AlreadyClaimed();
        }

        claimed[msg.sender] = true;

        if (wildAmount > 0) IERC20(rewardToken).safeTransfer(msg.sender, wildAmount);
        if (lpAmount > 0) IERC20(lpToken).safeTransfer(msg.sender, lpAmount);

        emit Claimed(msg.sender, wildAmount, lpAmount);
    }

    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
        // emit MerkleRootSet(_merkleRoot);
    }

    // admin function to allow owner withdrawal of any unclaimed
    function withdraw() external onlyOwner {
        // maybe put some timer here to show owner can't withdraw anything until a specific date
        // e.g. if block.timestamp != withdrawTimestamp set in config or something

        uint256 wildAmount = IERC20(rewardToken).balanceOf(address(this));
        uint256 lpAmount = IERC20(lpToken).balanceOf(address(this));

        IERC20(rewardToken).safeTransfer(owner(), wildAmount);
        IERC20(lpToken).safeTransfer(owner(), lpAmount);

        emit Withdrawn(owner(), wildAmount, lpAmount);
    }
}