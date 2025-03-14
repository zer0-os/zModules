// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IMigrationClaim {
    /**
     * @notice Emit when a user claims their tokens
     * @param account Address of the account claiming
     * @param amount Amount of WILD claimed
     * @param lpAmount Amount of LP token claimed
     */
    event Claimed(
        address indexed account,
        uint256 indexed amount,
        uint256 indexed lpAmount
    );

    /**
     * @notice Emit when the owner withdraws unclaimed tokens
     * @param owner Owner of the contract
     * @param wildAmount Amount of WILD that was transferred
     * @param lpAmount Amount of LP token that was transferred
     */
    event Withdrawn(
        address indexed owner,
        uint256 indexed wildAmount,
        uint256 indexed lpAmount
    );

    /**
     * @notice Emit when a new Merkle Root is set
     * @param merkleRoot The new Merkle Root
     */
    event MerkleRootSet(bytes32 indexed merkleRoot);

    /**
     * @notice Emit when the rewards vault is set
     * @param rewardsVault The new rewards vault
     */
    event RewardsVaultSet(address indexed rewardsVault);

    /**
     * @notice Emit when the WILD token is set
     * @param wildToken The new WILD token
     */
    event WildTokenSet(address indexed wildToken);

    /**
     * @notice Emit when the LP token is set
     * @param lpToken The new LP token
     */
    event LpTokenSet(address indexed lpToken);

    /**
     * @notice Throw when a user has already claimed their tokens
     */
    error AlreadyClaimed();

    /**
     * @notice Throw when a merkle proof is invalid
     */
    error InvalidProof();

    /**
     * @notice Throw when no rewards are owed to avoid empty transfers
     */
    error ZeroValue();

    /**
     * @notice Throw when a setting a variable to zero
     */
    error NoZeroVariables();

    function claim(
        bytes32[] memory proof,
        uint256 wildAmount,
        uint256 lpAmount
    ) external;

    function setMerkleRoot(bytes32 _merkleRoot) external;

    function setRewardsVault(address _rewardsVault) external;

    function setWildToken(address _wildToken) external;

    function setLpToken(address _lpToken) external;
}