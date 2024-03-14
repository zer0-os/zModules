// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IMultiStaking} from "./IMultiStaking.sol";
import {ABaseStaking} from "./ABaseStaking.sol";

/**
 * @title MultiStaking - A contract for creating multiple staking configurations, or "pools", for ERC721 tokens
 * that earn rewards in ERC20 tokens.
 *
 * @notice When this contract is deployed, the deploying account is set to be the `admin`.
 * This role is transferrable if the current admin calls `setAdmin`
 *
 * To create a staking pool, the `admin` must call `createPool` with the necessary details for the staking pool
 * as defined in the `PoolConfig` struct. This struct specifies:
 *
 * - The token that is being staked
 * - The token that is being distributed as rewards (optional)
 * - The address of the vault that holds the rewards tokens (optional, required if using rewards)
 * - The type of the staking token (ERC721, ERC20, ERC1155)
 * - The amount of rewards tokens distributed per block (optional, required if using rewards)
 * - The minimum amount of time to have passed before a person can claim (optional)
 *
 * Calling `createPool` will create a `poolId` that is the keccak256 hash of the given `PoolConfig` struct.
 * The `poolId` creates a unique identifier for each instance of a pool, allowing for several to exist for the
 * same ERC721 token. This value is `keccak256(abi.encodePacked(stakingToken, rewardsToken, rewardsPerBlock))`.
 *
 * @dev This contract is upgradeable.
 */
contract MultiStaking is ERC721, ABaseStaking, IERC1155Receiver, IMultiStaking {
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
            IERC721(configs[poolId].stakingToken).ownerOf(tokenId) == msg.sender,
            "Caller is not the owner of the NFT to stake"
        );
        _;
    }

    modifier onlySNFTOwner(uint256 stakeNonce) {
        StakeProfile storage staker = stakers[msg.sender];

        // Number of stakes is always currentStakeNonce
        // but they are added to the mapping before incrementing currentStakeNonce
        // so have indices of currentStakeNonce - 1
        require(
            stakeNonce < staker.currentStakeNonce,
            "Invalid stake nonce"
        );

		Stake memory _stake = staker.stakesMap[stakeNonce];

		require(
			// Will fail with `invalid id` if `uint256(_stake)` does not exist
			ownerOf(uint256(keccak256(abi.encode(_stake)))) == msg.sender,
			"Caller is not the owner of the SNFT"
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
    mapping(bytes32 poolId => PoolConfig config) public configs;

    // Every user maps to a StakeProfile struct
    mapping(address user => StakeProfile staker) public stakers;

	constructor(
		string memory name,
		string memory symbol,
		PoolConfig[] memory _configs
	) ERC721(name, symbol) {
		admin = msg.sender;
		// with multiple pools and contracts, tokenIds have to be guaranteed unique
		// so we hash them to create stakeIds and `uint256(stakeId)` is the token we mint
		// this wouldnt work with depositFor
		// but we could override depositFor, it is virtual

		uint256 i = 0;
		uint256 length = _configs.length;
		for(i; i < length;) {
			_createPool(_configs[i]);
            unchecked {
                ++i;
            }
		}
	}

    /**
     * @notice Create a staking pool with the given configuration. For a user to stake
     * in a pool. one must be configured by the admin first.
     *
     * @param _config The staking token, rewards token (optional), and rewardsPerBlock (optional) details
     */
    function createPool(PoolConfig memory _config) public onlyAdmin {
        _createPool(_config);
    }

	/**
	 * @notice Stake an asset of either ERC721, ERC20, or ERC1155 into an existing pool
	 * 
	 * @param poolId The ID of the pool to stake in
	 * @param tokenId The ID of the NFT to stake (0 if not ERC721 pool)
	 * @param amount The amount of tokens to stake (0 if not ERC20 pool)
	 * @param index The index of the asset to stake (0 if not ERC1155 pool)
	 */
	function stake(
		bytes32 poolId,
		uint256 tokenId,
		uint256 amount,
		uint256 index
    ) external onlyExists(poolId) {
		PoolConfig memory config = configs[poolId];

		// One of `tokenId` or `amount` must be non-zero
		require(
			tokenId != 0 || amount != 0,
			"Cannot create empty stake"
		);

        StakeProfile storage staker = stakers[msg.sender];

		// Transfer appropriate token types
		if(config.stakingTokenType == TokenType.IERC721) {
			_stakeERC721(poolId, tokenId);
		} else if(config.stakingTokenType == TokenType.IERC20) {
			_stakeERC20(poolId, amount);
		} else {
			// On pool creation we validate staking token type, so it's
			// safe to assume final case is ERC1155
			_stakeERC1155(poolId, tokenId, amount);
		}

        // Log stake for user
        Stake memory _stake = Stake({
            poolId: poolId,
            tokenId: tokenId,
            amount: amount,
            index: index,
            stakedOrClaimedAt: block.number
        });

        // The nth stake is `stake`, then keep `currentStakeNonce` as incremental value
        // means we always can track all the stakes for a user without holding an array
        staker.stakesMap[staker.currentStakeNonce] = _stake;
        unchecked {
            ++staker.currentStakeNonce;
        }

        // Mint the owner an SNFT
		_mint(msg.sender, uint256(keccak256(abi.encode(_stake))));

        // why would is this unreachable?
		emit Staked(_stake, msg.sender);
    }

	/**
	 * @notice Claim rewards from a valid stake
	 * 
	 * @param stakeNonce The integer number identifier of a stake for a user
	 */
	function claim(uint256 stakeNonce) external onlySNFTOwner(stakeNonce) {
        StakeProfile storage staker = stakers[msg.sender];

		Stake memory _stake = staker.stakesMap[stakeNonce];

        PoolConfig memory config = configs[_stake.poolId];

        require(
            address(config.rewardsToken) != address(0),
            "Pool does not have rewards configured"
        );

		// Confirm rewards can be claimed
		require(
			block.number - _stake.stakedOrClaimedAt > config.minRewardsTime,
			"Minimum time to claim rewards has not passed"
		);

        uint256 accessBlock = _stake.stakedOrClaimedAt;
		_stake.stakedOrClaimedAt = block.number;

        config.rewardsToken.transfer(
            msg.sender,
            config.rewardsPerBlock * (block.number - accessBlock)
        );
        // emit claimed
	}

    function claimAll() external {
        uint256 totalRewards = _getPendingRewardsTotal();
        // TODO can this be done? need way to transfer for each token?
        // could be done if we do a bunch of invidual transfers, but that's very gas
        // if the user has more than a few stakes
    }

    

    function getPendingRewardsTotal() external view returns(uint256) {
        return _getPendingRewardsTotal();
    }
    
    // TODO make sure the user can see rewards available in a pool before they stake
    // getPendingRewards(uint256 stakeNonce)
    // getPendingRewardsTotal() => use this in claimAll

    // TODO
    // getPendingRewards for a user for a specific stake
    // getPendingRewardsTotal for a user
    // add way to see all users in a pool
    // add way to see all stakes for a user
    // unstakeAll, unstake all the stakes for a user

    // If they have not passed the rewardsTime do we
        // TODO double check this with neo and joel
        // A) revert
        // B) successfully unstake, forfeiting rewards <-- This one, for now
    // If they have passed the rewardsTime, claim rewards and unstake

    /**
     * @notice Unstake
     *
     * @param stakeNonce The integer number identifier of a stake for a user
     */
    function unstake(uint256 stakeNonce) external onlySNFTOwner(stakeNonce) {
        StakeProfile storage staker = stakers[msg.sender];

		Stake memory _stake = staker.stakesMap[stakeNonce];

        require(
            _stake.stakedOrClaimedAt != 0,
            "Stake has already been unstaked"
        );

        // Mark stake as removed
        uint256 blockDiff = block.number - _stake.stakedOrClaimedAt;
        _stake.stakedOrClaimedAt = 0;

        PoolConfig memory config = configs[_stake.poolId];

        // If rewards are configured and the stake existed for long enough
        if (address(config.rewardsToken) == address(0) && blockDiff > config.minRewardsTime) {
            uint256 rewards = config.rewardsPerBlock * blockDiff;

            config.rewardsToken.transfer(
                msg.sender,
                rewards
            );
        } else {
            // Revert or allow unstake?
            // revert();
        }

        // Burn the SNFT
        _burn(uint256(keccak256(abi.encode(_stake))));

        // Return NFT to the original staker
		if (config.stakingTokenType == TokenType.IERC721) {
			IERC721(config.stakingToken).transferFrom(
				address(this),
				msg.sender,
				_stake.tokenId
			);
		} else if (config.stakingTokenType == TokenType.IERC20) {
            uint256 amount = _stake.amount;
            _stake.amount = 0;

            IERC20(config.stakingToken).transferFrom(
                address(this),
                msg.sender,
                amount
            );
		} else {
            uint256 amount = _stake.amount;
            _stake.amount = 0;

            IERC1155(config.stakingToken).safeTransferFrom(
                address(this),
                msg.sender,
                _stake.tokenId,
                amount,
                ""
            );
		}

        // emit unstaked
    }

    /**
     * @notice Get the poolId for a given staking configuration
     * @param _config The configuration to be hashed to create the poolId
     */
    function getPoolId(
        PoolConfig memory _config
    ) public pure returns (bytes32) {
        return _getPoolId(_config);
    }

    /**
     * @notice Get the admin of this contract
     */
    function getAdmin() public view returns (address) {
        return admin;
    }

    /**
     * @notice Get the staking token for a given pool
     * @param poolId The pool to check
     */
    function getRewardsPerBlockForPool(
        bytes32 poolId
    ) public view returns (uint256) {
        return configs[poolId].rewardsPerBlock;
    }

    /**
     * @notice Get the staking token for a given pool
     * @param poolId The pool to check
     */
    function getStakingTokenForPool(
        bytes32 poolId
    ) public view returns (address, TokenType) {
        return (configs[poolId].stakingToken, configs[poolId].stakingTokenType);
    }

    /**
     * @notice Get the rewards token for a given pool
     * @param poolId The pool to check
     */
    function getRewardsTokenForPool(
        bytes32 poolId
    ) public view returns (IERC20) {
        return configs[poolId].rewardsToken;
    }

    // View the amount of rewards remaining to be distributed to staking users
    function getAvailableRewardsForPool(bytes32 poolId) public view returns (uint256) {
        PoolConfig memory config = configs[poolId];
        return config.rewardsToken.balanceOf(address(this));
    }

    // Show the remaining amount of time before a staker can claim rewards
    function getRemainingTimeToClaim(uint256 stakeNonce) public view returns (uint256) {
        StakeProfile storage staker = stakers[msg.sender];
        Stake memory _stake = staker.stakesMap[stakeNonce];

        uint256 canClaimAt = _stake.stakedOrClaimedAt + configs[_stake.poolId].minRewardsTime;

        if (block.number < canClaimAt) {
            return canClaimAt - block.number;
        } else {
            return 0;
        }
    }

    /**
     * @notice Set the new admin for this contract. Only callable by
     * the current admin.
     * @param _admin The new admin to set
     */
    function setAdmin(address _admin) public onlyAdmin {
        require(_admin != address(0), "Admin cannot be zero address");
        admin = _admin;
    }

    /**
     * @notice Delete a staking pool. Only callable by the admin.
     * @param poolId The poolId of the pool to delete
     */
    function deletePool(
        bytes32 poolId
    ) public onlyAdmin onlyExists(poolId) {
        // TODO should we allow this? what if there are still stakers?
        // how will we reconcile all the existing stakes + rewards?
        // have to track every stake in every pool, if so
        // then iterate each stake in the pool being deleted and forcefully unstake each
        delete configs[poolId];
        // emit PoolDeleted(poolId, admin);
    }

    // ERC1155Receiver implementation
    // Values from IERC1155Receiver
    bytes4 private constant INTERFACE_ID_ERC1155_RECEIVED = 0xf23a6e61;
    bytes4 private constant INTERFACE_ID_ERC1155_BATCH_RECEIVED = 0xbc197c81;

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return INTERFACE_ID_ERC1155_RECEIVED;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return INTERFACE_ID_ERC1155_BATCH_RECEIVED;
    }

    function _getPendingRewardsTotal() internal view returns (uint256) {
        StakeProfile storage staker = stakers[msg.sender];

        uint256 i = 0;
        uint256 len = staker.currentStakeNonce;

        // TODO pools could use different erc20s in rewards
        // so total rewards could be x of token A, and y of token B, and so on
        // how do we show this correctly, instead of just `rewardsTotal` like below

        // Could this be an option? can't create mappings dynamically, but could build out two arrays 
        // to create a "mapping" maybe
        // ERC20 => rewardAmounts
        IERC20[] memory rewardsTokens;
        uint256[] memory rewardsAmounts; 

        uint256 rewardsTotal;
        Stake memory _stake;
        PoolConfig memory config;

        for(i; i < len;) {
            _stake = staker.stakesMap[i];
            config = configs[_stake.poolId];

            if (
                // The token is burned on unstake and non-transferable, if not the owner it's invalid
                ownerOf(uint256(keccak256(abi.encode(_stake)))) == msg.sender
                &&
                // Stake must be able to be claimed
                block.number - _stake.stakedOrClaimedAt > config.minRewardsTime
            ) {
                
                rewardsTotal += config.rewardsPerBlock * (block.number - _stake.stakedOrClaimedAt);
                _stake.stakedOrClaimedAt = block.number;
            }
            unchecked {
                ++i;
            }
        }

        return rewardsTotal;
    }

    function _createPool(PoolConfig memory _config) internal {
		// Staking token must not be zero
        require(
            address(_config.stakingToken) != address(0),
            "Staking token must not be zero"
        );

		// Rewards token can optionally be 0 if there are no rewards in a pool
        if (address(_config.rewardsToken) != address(0)) {
            require(
                _config.rewardsPerBlock != 0,
                "Invalid rewards configuration"
            );
        }

		require(
			// Enum for token types is
            // 0 - ERC721
            // 1 - ERC20
            // 2 - ERC1155
			// So 3 or higher is an invalid token type
			uint256(_config.stakingTokenType) < 3,
			"Invalid stake or rewards token type"
		);

        bytes32 poolId = _getPoolId(_config);

        // Staking configuration must not already exist
        require(
            address(configs[poolId].stakingToken) == address(0),
            "Staking configuration already exists"
        );

        configs[poolId] = _config;
        emit PoolCreated(poolId, _config);
	}

    function _getPoolId(
        PoolConfig memory _config
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _config.stakingToken,
                    _config.rewardsToken,
                    _config.rewardsPerBlock,
					_config.minRewardsTime
                )
            );
    }

	// Stake for ERC721s, routed from main `stake` function
	function _stakeERC721(bytes32 poolId, uint256 tokenId) internal {
		require(
			IERC721(configs[poolId].stakingToken).ownerOf(tokenId) == msg.sender,
			"Caller is not the owner of the NFT to stake"
		);

		// Transfer the stakers NFT
		IERC721(configs[poolId].stakingToken).transferFrom(
			msg.sender,
			address(this),
			tokenId
		);
	}

	function _stakeERC20(bytes32 poolId, uint256 amount) internal {
		require(
			amount != 0,
			"Amount must be non-zero when staking ERC20"
		);

		// Transfer the stakers funds
		IERC20(configs[poolId].stakingToken).transferFrom(
			msg.sender,
			address(this),
			amount
		);
	}

	function _stakeERC1155(
		bytes32 poolId,
		uint256 tokenId,
		uint256 amount
	) internal {
        // TODO test confirm balance
		IERC1155(configs[poolId].stakingToken).safeTransferFrom(
			msg.sender,
			address(this),
			tokenId,
			amount,
			""
		);
	}

    // Only `_mint` and `_burn`
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal pure override {
        // The SNFT is not transferrable
        require(from == address(0) || to == address(0), "Token is non-transferable");
    }
}
