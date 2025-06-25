// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IZeroRewardsVault {
    /**
     * @notice Emitted when a user successfully claims rewards.
     * @param user The address of the user who claimed.
     * @param amount The amount of rewards claimed.
     * @param merkleProof The Merkle proof used for the claim.
     */
    event Claimed(address indexed user, uint256 amount, bytes32[] merkleProof);

    /**
     * @notice Emitted when the Merkle root is updated.
     * @param newRoot The new Merkle root.
     */
    event MerkleRootUpdated(bytes32 indexed newRoot);

    /**
     * @notice Thrown when the Merkle root is zero.
     */
    error ZeroMerkleRoot();

    /**
     * @notice Thrown when the token address is zero.
     */
    error ZeroTokenAddress();

    /**
     * @notice Thrown when the provided Merkle proof is invalid.
     * @param merkleProof The invalid Merkle proof.
     */
    error InvalidMerkleProof(bytes32[] merkleProof);

    /**
     * @notice Thrown when there are no rewards to claim for the user.
     * @param user The address of the user.
     */
    error NoRewardsToClaim(address user);
 
    /**
     * @notice Sets a new Merkle root for rewards distribution.
     * @param _root The new Merkle root.
     */
    function setMerkleRoot(bytes32 _root) external;

    /**
     * @notice Pauses the contract, disabling claims.
     */
    function pause() external;

    /**
     * @notice Unpauses the contract, enabling claims.
     */
    function unpause() external;

    /**
     * @notice Claims rewards for the sender using a Merkle proof.
     * @param totalCumulativeRewards The total cumulative rewards to claim.
     * @param merkleProof The Merkle proof for the claim.
     */
    function claim(uint256 totalCumulativeRewards, bytes32[] calldata merkleProof) external;

    /**
     * @notice Returns the total amount of rewards claimed by all users.
     * @return The total claimed rewards.
     */
    function totalClaimed() external view returns (uint256);

    /**
     * @notice Returns the address of the ERC20 token used for rewards.
     * @return The token address.
     */
    function token() external view returns (address);

    /**
     * @notice Returns the total amount claimed by a specific user.
     * @param user The address of the user.
     * @return The amount claimed by the user.
     */
    function claimed(address user) external view returns (uint256);
}
