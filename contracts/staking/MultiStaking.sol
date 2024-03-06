// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {IMultiStaking} from "./IMultiStaking.sol";

/**
 * @title MultiStaking - A contract for creating multiple staking configurations, or "pools", for ERC721 tokens
 * that earn rewards in ERC20 tokens.
 *
 * @notice When this contract is deployed, the deploying account is set to be the `admin`.
 * This role is transferrable if the current admin calls `setAdmin`
 *
 * To create a staking pool, the `admin` must call `createPool` with the necessary details for the staking pool
 * as defined in the `StakeConfig` struct. This specifies:
 *
 * - The ERC721 token that is being staked
 * - The ERC20 token that is being distributed as rewards (optional)
 * - The amount of rewards tokens distributed per block (optional)
 *
 * Calling `createPool` will create a `poolId` that is the keccak256 hash of the given `StakeConfig` struct.
 * The `poolId` creates a unique identifier for each instance of a pool, allowing for several to exist for the
 * same ERC721 token. This value is `keccak256(abi.encodePacked(stakingToken, rewardsToken, rewardsPerBlock))`.
 *
 * @dev This contract is upgradeable.
 */
contract MultiStaking is ERC721Upgradeable, IMultiStaking {
    /**
     * @notice Restrict functions to be useable only by the `admin` set on deployment
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Caller is not the admin");
        _;
    }

    /**
     * @notice Restrict functions to be useable only by the owner of the original NFT
     */
    modifier onlyNFTOwner(bytes32 poolId, uint256 tokenId) {
        require(
            configs[poolId].stakingToken.ownerOf(tokenId) == msg.sender,
            "Caller is not the owner of the NFT to stake"
        );
        _;
    }

    /**
     * @notice Confirm if a pool exists before being able to stake in it.
     */
    modifier onlyExists(bytes32 poolId) {
        require(
            address(configs[poolId].stakingToken) != address(0),
            "Staking pool does not exist"
        );
        _;
    }

    // The operator of this contract
    address public admin;

    // Mapping to track staking configurations
    mapping(bytes32 poolId => StakeConfig config) public configs;

    // Mapping to track when a token was last accessed by the system
    mapping(bytes32 stakeId => uint256 blockNumber) public stakedOrClaimedAt;

    // We track the original staker of the NFT to allow the SNFT to be transferable
    // and still return the original NFT to the original staker on unstake
    mapping(bytes32 stakeId => address staker) public originalStakers;

    function initialize(
        string memory name,
        string memory symbol
    ) public override initializer {
        admin = msg.sender;
        __ERC721_init(name, symbol);
    }

    /**
     * @notice Create a staking pool with the given configuration. For a user to stake
     * in a pool. one must be configured by the admin first.
     *
     * @param _config The staking token, rewards token (optional), and rewardsPerBlock (optional) details
     */
    function createPool(StakeConfig memory _config) public override onlyAdmin {
        // Staking token must not be zero, but rewards token can optionally be
        require(
            address(_config.stakingToken) != address(0),
            "Staking token must not be zero"
        );

        bytes32 poolId = keccak256(
            abi.encodePacked( // 0 checks here?
                _config.stakingToken,
                _config.rewardsToken,
                _config.rewardsPerBlock
            )
        );

        // Staking configuration must not already exist
        require(
            address(configs[poolId].stakingToken) == address(0),
            "Staking configuration already exists"
        );

        configs[poolId] = _config;
        emit PoolCreated(poolId, _config, admin);
    }

    /**
     * @notice Stake an NFT into a pool. Only the owner of the NFT can call to stake it.
     * Will fail if the staking pool has not been created yet.
     *
     * @param poolId The pool to stake in
     * @param tokenId The NFT to stake
     */
    function stake(
        bytes32 poolId,
        uint256 tokenId
    ) external override onlyExists(poolId) onlyNFTOwner(poolId, tokenId) {
        // without tying the tokenId to the poolId somehow, they are not bound in any way
        // this means a user who staked in Pool A could successfully call unstake from Pool B
        // with their SNFT, because the system only sees "this token is staked" not *where* it is staked
        // As a result, we must create a unique stakeId made from `poolId` and `tokenId`
        bytes32 stakeId = keccak256(abi.encodePacked(poolId, tokenId));

        // Mark the staking block number
        stakedOrClaimedAt[stakeId] = block.number;

        // Transfer the staker's NFT
        configs[poolId].stakingToken.transferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Mark the user as the original staker for return in unstake
        originalStakers[stakeId] = msg.sender;

        // Mint the owner an SNFT
        _mint(msg.sender, uint256(stakeId));
        emit Staked(poolId, tokenId, msg.sender);
    }

    /**
     * @notice Claim rewards from a staked NFT. Only the owner of the SNFT can call to claim rewards.
     *
     * @param poolId The pool where the existing stake exists
     * @param tokenId The NFT staked in the given pool
     */
    function claim(bytes32 poolId, uint256 tokenId) external override {
        // TODO we don't actually need `tokenId` here for anything other
        // than the event emission. It would be a gas improvement to remove it
        // and just have `bytes32 stakeId` as the parameter instead
        // But this would make it so we can't emit it, and the "stake, claim, unstake"
        // funcs wouldn't be identical in their parameters
        bytes32 stakeId = keccak256(abi.encodePacked(poolId, tokenId));

        require(
            ownerOf(uint256(stakeId)) == msg.sender,
            "Caller is not the owner of the representative stake token"
        );

        // Calculate and transfer rewards
        uint256 rewards = configs[poolId].rewardsPerBlock *
            (block.number - stakedOrClaimedAt[stakeId]);

        // Update to most recently claimed block
        stakedOrClaimedAt[stakeId] = block.number;

        configs[poolId].rewardsToken.transfer(msg.sender, rewards);

        emit Claimed(poolId, tokenId, msg.sender, rewards);
    }

    /**
     * @notice Unstake a staked NFT from a pool. Only the owner of the SNFT can call to unstake.
     * Any pending rewards accrued from the staked NFT will be transferred to the caller and
     * the original NFT will be returned to the original staker.
     *
     * @param poolId The pool where the existing stake exists
     * @param tokenId The NFT staked in the given pool
     */
    function unstake(bytes32 poolId, uint256 tokenId) external override {
        // TODO maybe original NFT owner has to allow the SNFT owner to call unstake
        // otherwise the original NFT would have to resubmit to stake again if they didn't
        // want to unstake. But also maybe this is just a mechanic they have to accept as part
        // of allowing the SNFT to be transferrable
        bytes32 stakeId = keccak256(abi.encodePacked(poolId, tokenId));

        require(
            ownerOf(uint256(stakeId)) == msg.sender,
            "Caller is not the owner of the representative stake token"
        );

        // Bring mapping into memory instead of accessing storage 3 times
        StakeConfig memory config = configs[poolId];

        // Return NFT to the original staker
        config.stakingToken.transferFrom(
            address(this),
            originalStakers[stakeId],
            tokenId
        );

        // Burn the SNFT
        // Note: The internal `_burn` used here does not check if the sender is authorized
        // This allows us to call to `_burn` without possession of the token, as the ERC721 contract
        // Because only the SNFT owner can call this function anyways, this feels similar in their
        // consent to if they were required to transfer it, and then we burnt it.
        _burn(uint256(stakeId));

        // Calculate the rewards
        uint256 rewards = config.rewardsPerBlock *
            (block.number - stakedOrClaimedAt[stakeId]);

        // Update staked mappings
        stakedOrClaimedAt[stakeId] = 0;
        originalStakers[stakeId] = address(0);

        // Transfer the rewards
        config.rewardsToken.transfer(msg.sender, rewards);
        emit Unstaked(poolId, tokenId, msg.sender, rewards);
    }

    /**
     * @notice See if a particular token is currently being staked in a pool
     * @param poolId The pool to check
     * @param tokenId The NFT to check
     */
    function isStaking(
        bytes32 poolId,
        uint256 tokenId
    ) public view override returns (bool) {
        return
            stakedOrClaimedAt[keccak256(abi.encodePacked(poolId, tokenId))] !=
            0;
    }

    /**
     * @notice Get the poolId for a given staking configuration
     * @param _config The configuration to be hashed to create the poolId
     */
    function getPoolId(
        StakeConfig memory _config
    ) public pure override returns (bytes32) {
        return _getPoolId(_config);
    }

    /**
     * @notice Get the stakeId for a given poolId and tokenId
     * @param poolId The pool an NFT was staked in
     * @param tokenId The staked NFT
     */
    function getStakeId(
        bytes32 poolId,
        uint256 tokenId
    ) public pure override returns (bytes32) {
        return keccak256(abi.encodePacked(poolId, tokenId));
    }

    /**
     * @notice Get the admin of this contract
     */
    function getAdmin() public view override returns (address) {
        return admin;
    }

    /**
     * @notice Get the pending rewards for a given staked NFT
     * @param poolId The pool an NFT was staked in
     * @param tokenId The staked NFT
     */
    function getPendingRewards(
        bytes32 poolId,
        uint256 tokenId
    ) public view override returns (uint256) {
        uint256 stakedBlocks = (block.number -
            stakedOrClaimedAt[keccak256(abi.encodePacked(poolId, tokenId))]);
        return configs[poolId].rewardsPerBlock * stakedBlocks;
    }

    /**
     * @notice Get the staking token for a given pool
     * @param poolId The pool to check
     */
    function getRewardsPerBlock(
        bytes32 poolId
    ) public view override returns (uint256) {
        return configs[poolId].rewardsPerBlock;
    }

    /**
     * @notice Get the staking token for a given pool
     * @param poolId The pool to check
     */
    function getStakingToken(
        bytes32 poolId
    ) public view override returns (IERC721Upgradeable) {
        return configs[poolId].stakingToken;
    }

    /**
     * @notice Get the rewards token for a given pool
     * @param poolId The pool to check
     */
    function getRewardsToken(
        bytes32 poolId
    ) public view override returns (IERC20Upgradeable) {
        return configs[poolId].rewardsToken;
    }

    /**
     * @notice Set the new admin for this contract. Only callable by
     * the current admin.
     * @param _admin The new admin to set
     */
    function setAdmin(address _admin) public override onlyAdmin {
        require(_admin != address(0), "Admin cannot be zero address");
        admin = _admin;
    }

    /**
     * @notice Delete a staking pool. Only callable by the admin.
     * @param poolId The poolId of the pool to delete
     */
    function deletePool(
        bytes32 poolId
    ) public override onlyAdmin onlyExists(poolId) {
        // TODO should we allow this? what if there are still stakers?
        // how will we reconcile all the existing stakes + rewards?
        // have to track every stake in every pool, if so
        // then iterate each stake in the pool being deleted and forcefully unstake each
        delete configs[poolId];
        emit PoolDeleted(poolId, admin);
    }

    function _getPoolId(
        StakeConfig memory _config
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _config.stakingToken,
                    _config.rewardsToken,
                    _config.rewardsPerBlock
                )
            );
    }
}
