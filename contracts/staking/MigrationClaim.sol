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
    mapping(address user => bool hasClaimed) public claimed;

    constructor(
        bytes32 _merkleRoot,
        address _owner,
        address _rewardsVault,
        IERC20 _wildToken,
        IERC20 _lpToken
    ) Ownable(_owner) {
        if (
            _merkleRoot == bytes32(0) ||
            _rewardsVault == address(0) ||
            address(_wildToken) == address(0) ||
            address(_lpToken) == address(0)
        ) {
            revert NoZeroVariables();
        }

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
    ) external override {
        // User's that have already claimed cannot claim again
        if (claimed[msg.sender]) {
            revert AlreadyClaimed();
        }

        bytes32 leaf = keccak256(
            bytes.concat(
                keccak256(
                    abi.encode(
                        msg.sender,
                        wildAmount,
                        lpAmount
                    )
                )
            )
        );

        if (!MerkleProof.verify(proof, merkleRoot, leaf)) {
            revert InvalidProof();
        }

        // Disallow empty transfers
        // Note: This should never happen because we sanitize the incoming data
        // but it is here in case of future changes or bugs
        if (wildAmount == 0 && lpAmount == 0) {
            revert ZeroValue();
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
    function setMerkleRoot(bytes32 _merkleRoot) external override onlyOwner {
        if (_merkleRoot == bytes32(0)) {
            revert NoZeroVariables();
        }
        merkleRoot = _merkleRoot;

        emit MerkleRootSet(_merkleRoot);
    }

    /**
     * @notice Allow the owner to set a new rewards vault
     * @param _rewardsVault The new rewards vault
     */
    function setRewardsVault(address _rewardsVault) external override onlyOwner {
        if (_rewardsVault == address(0)) {
            revert NoZeroVariables();
        }

        rewardsVault = _rewardsVault;

        emit RewardsVaultSet(_rewardsVault);
    }

    /**
     * @notice Allow the owner to set the WILD token address
     * @dev It is unlikely we need this function but it is here in case of error to avoid
     * having to redeploy the contract
     * 
     * @param _wildToken The WILD token contract address
     */
    function setWildToken(address _wildToken) external override onlyOwner {
        if (_wildToken == address(0)) {
            revert NoZeroVariables();
        }

        wildToken = IERC20(_wildToken);
        emit WildTokenSet(_wildToken);
    }

    /**
     * @notice Allow the owner to set the LP token address
     * @dev It is unlikely we need this function but it is here in case of error to avoid
     * having to redeploy the contract
     * 
     * @param _lpToken The LP token contract address
     */
    function setLpToken(address _lpToken) external override onlyOwner {
        if (_lpToken == address(0)) {
            revert NoZeroVariables();
        }

        lpToken = IERC20(_lpToken);
        emit LpTokenSet(_lpToken);
    }
}