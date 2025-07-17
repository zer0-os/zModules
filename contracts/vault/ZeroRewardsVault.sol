// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { OwnableOperable } from "contracts/access/OwnableOperable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IZeroRewardsVault } from "./IZeroRewardsVault.sol";


contract ZeroRewardsVault is OwnableOperable, Pausable, ReentrancyGuard, IZeroRewardsVault {
    using SafeERC20 for IERC20;

    /// @notice The current Merkle root used for rewards distribution.
    bytes32 public _merkleRoot;

    /// @notice The total amount of rewards claimed by all users.
    uint256 public totalClaimed;

    /// @notice The address of the ERC20 token used for rewards.
    address public token;

    /// @notice Mapping of user address to the total amount claimed.
    mapping(address user => uint256 totalClaimed) public claimed;

    constructor(
        address _owner,
        address _token
    )
        OwnableOperable(_owner)
        Pausable()
        ReentrancyGuard() {
            if (_token == address(0)) revert ZeroTokenAddress();
            token = _token;
        }

    /**
     * @notice Pauses the contract, disabling the claim functionality.
     * @dev Only callable by the contract owner when not already paused.
     */
    function pause() external override onlyAuthorized whenNotPaused {
        _pause();
    }

    /**
     * @notice Unpauses the contract, enabling the claim functionality.
     * @dev Only callable by the contract owner when paused.
     */
    function unpause() external override onlyAuthorized whenPaused {
        _unpause();
    }

    /**
     * @notice Sets a new Merkle root for rewards distribution.
     * @dev Only callable by the contract owner. Reverts if the root is zero.
     * @param _root The new Merkle root.
     */
    function setMerkleRoot(bytes32 _root) public override onlyAuthorized {
        if (_root == bytes32(0)) revert ZeroMerkleRoot();

        _merkleRoot = _root;
        emit MerkleRootUpdated(_root);
    }

    /**
     * @notice Claims rewards for the sender using a Merkle proof.
     * @dev The function verifies the provided Merkle proof for the (msg.sender, totalCumulativeRewards) leaf.
     *      If the proof is valid and the user has unclaimed rewards, the contract transfers the difference
     *      between the new cumulative amount and the previously claimed amount to the user.
     *      Emits a {Claimed} event on success.
     * @param totalCumulativeRewards The total cumulative rewards allocated to the user (including previous claims).
     * @param merkleProof The Merkle proof that proves the user's entitlement to the specified cumulative rewards.
     */
    function claim(
        uint256 totalCumulativeRewards,
        bytes32[] calldata merkleProof
    ) public override nonReentrant whenNotPaused {
        bytes32 leaf = keccak256(
            bytes.concat(
                keccak256(
                    abi.encode(msg.sender, totalCumulativeRewards)
                )
            )
        );

        if (
            !MerkleProof.verify(
                merkleProof,
                _merkleRoot,
                leaf
            )
        ) revert InvalidMerkleProof(merkleProof);

        uint256 amount = totalCumulativeRewards - claimed[msg.sender];
        if (amount == 0) revert NoRewardsToClaim(msg.sender);

        claimed[msg.sender] += amount;
        totalClaimed += amount;

        IERC20(token).safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount, merkleProof);
    }
}
