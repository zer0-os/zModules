// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IVault } from "./IVault.sol";

/**
 * @title Vault
 * @notice A contract to hold funds previously staked funds and allow eligible users to claim them
 * @author James Earle <https://github.com/JamesEarle>
 */
contract Vault is Ownable, IVault {
    using SafeERC20 for IERC20;

    bytes32 public merkleRoot;
    IERC20 public rewardToken; // TODO names to make these more abstract, not tied to specific tokens
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
        address account,
        uint256 wildAmount, // should have two amounts, WILD and LP
        uint256 lpAmount // should have two amounts, WILD and LP
    ) external onlyOwner {
        bytes32 leaf = keccak256(abi.encodePacked(account, wildAmount, lpAmount));
        
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) {
            revert InvalidProof();
        }   

        // Mark user as claimed
        claimed[account] = true; // TODO store ts too?

        // TODO make names of tokens more abstract
        // array of addresses? any number of tokens
        IERC20(rewardToken).safeTransfer(msg.sender, wildAmount);
        IERC20(lpToken).safeTransfer(msg.sender, lpAmount);

        emit Claimed(account, wildAmount, lpAmount);
    }
}