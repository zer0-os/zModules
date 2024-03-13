// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
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
 * - The type of the rewards token (ERC721, ERC20, ERC1155)
 * - The amount of rewards tokens distributed per block (optional, required if using rewards)
 * - The minimum amount of time to have passed before a person can claim (optional)
 *
 * Calling `createPool` will create a `poolId` that is the keccak256 hash of the given `PoolConfig` struct.
 * The `poolId` creates a unique identifier for each instance of a pool, allowing for several to exist for the
 * same ERC721 token. This value is `keccak256(abi.encodePacked(stakingToken, rewardsToken, rewardsPerBlock))`.
 *
 * @dev This contract is upgradeable.
 */
contract MultiStaking is ERC721, ABaseStaking, IMultiStaking {
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

    // Mapping to track when a token was last accessed by the system
    // mapping(bytes32 stakeId => uint256 blockNumber) public stakedOrClaimedAt;

    // We track the original staker of the NFT to allow the SNFT to be transferable
    // and still return the original NFT to the original staker on unstake
    // mapping(bytes32 stakeId => address staker) public originalStakers;

	// Track the total amount of ERC20 tokens staked in the contract by a user
	// We use this value for rewards calculation
	// mapping(address user => uint256 tokens) public totalStakedERC20;

    // Every user maps to a StakeProfile struct
    mapping(address user => StakeProfile staker) public stakers;

    // // Does total matter if we track this? maybe?
    // Need to track this for unstaking a specific stake
    // mapping(bytes32 stakeId => uint256 amount) public amountPerStakeERC20;

	// Maybe its better to track individual stakes, not the total staked (or do both?)
	// is both just adding unnecessary on chain data?

	// Track the total amount of fungible assets in an ERC1155 that are staked in 
	// the contract by a user. We use this value for rewards calculation
	// mapping(address user => mapping(uint256 index => uint256 amount)) public totalStakedERC1155;

	// TODO need to track ERC721 total? probably not

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
		for(i; i < length; ++i) {
			_createPool(_configs[i]);
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

	function _createPool(PoolConfig memory _config) internal {
		// Staking token must not be zero
        require(
            address(_config.stakingToken) != address(0),
            "Staking token must not be zero"
        );

		// Rewards token can optionally be 0 if there are no rewards in a pool
        if (address(_config.rewardsToken) != address(0)) {
            require(
                _config.rewardsPerBlock != 0  && _config.rewardsVault != address(0),
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

        // Every stake is unique
        // If they stake the first time, currentStakeNonce is 0
           // Can;t stake the same NFT again, no longer own it
           // Can stake again for ERC20s
		// bytes32 stakeId = keccak256(
		// 	abi.encodePacked(
		// 		poolId,
		// 		tokenId,
		// 		amount,
		// 		index,
        //         staker.currentStakeNonce,
		// 		msg.sender
		// 	)
		// );

        // TODO must include "unstakeAll option"

		// Transfer appropriate token types
		if(config.stakingTokenType == TokenType.IERC721) {
			_stakeERC721(poolId, tokenId);
		} else if(config.stakingTokenType == TokenType.IERC20) {
			_stakeERC20(poolId, amount);
		} else {
			// On pool creation we validate staking token type, so it's
			// safe to assume final case is ERC1155
			_stakeERC1155(poolId, tokenId, amount, index);
		}

        // Log stake for user
        Stake memory _stake = Stake({
            poolId: poolId,
            tokenId: tokenId,
            amount: amount,
            index: index,
            nonce: staker.currentStakeNonce,
            stakedOrClaimedAt: block.number
        });

        // The nth stake is `stake`, then keep `currentStakeNonce` as incremental value
        // means we always can track all the stakes for a user without holding an array
        staker.stakesMap[staker.currentStakeNonce] = _stake;
        staker.currentStakeNonce += 1;

        // Mint the owner an SNFT
		_mint(msg.sender, uint256(keccak256(abi.encode(_stake))));

        // why would is this unreachable?
		emit Staked(_stake, msg.sender);
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

	/**
	 * @notice Claim rewards from a valid stake
	 * 
	 * @param stakeNonce The integer number identifier of a stake for a user
	 */
	function claim(uint256 stakeNonce) external {
        StakeProfile storage staker = stakers[msg.sender]; // memory instead?
        // Number of stakes is always currentStakeNonce
        // but they are added to the mapping before incrementing currentStakeNonce
        // so have indices of currentStakeNonce - 1
        require(stakeNonce < staker.currentStakeNonce, "Invalid stake nonce");

		Stake memory _stake = staker.stakesMap[stakeNonce];

		require(
			// Will fail with `invalid id` if `uint256(_stake)` does not exist
			ownerOf(uint256(keccak256(abi.encode(_stake)))) == msg.sender,
			"Caller is not the owner of the SNFT"
		);

        PoolConfig memory config = configs[_stake.poolId];

        require(
            address(configs[_stake.poolId].rewardsToken) != address(0),
            "Pool does not have rewards configured"
        );

		// Confirm rewards can be claimed
		require(
			block.number - _stake.stakedOrClaimedAt > config.minRewardsTime,
			"Minimum time to claim rewards has not passed"
		);

        // TODO make sure the user can see rewards available in a pool before they stake
        uint256 accessBlock = _stake.stakedOrClaimedAt;
		_stake.stakedOrClaimedAt = block.number;

        config.rewardsToken.transferFrom(
            config.rewardsVault,
            msg.sender,
            config.rewardsPerBlock * (block.number - accessBlock)
        );
        // emit claimed
	}

    /**
     * @notice Unstake
     *
     * @param stakeNonce The integer number identifier of a stake for a user
     */
    function unstake(uint256 stakeNonce) external {
        StakeProfile storage staker = stakers[msg.sender]; // memory instead?

        // Number of stakes is always currentStakeNonce
        // but they are added to the mapping before incrementing currentStakeNonce
        // so have indices of currentStakeNonce - 1
        require(stakeNonce < staker.currentStakeNonce, "Invalid stake nonce");

		Stake memory _stake = staker.stakesMap[stakeNonce];
        
		require(
			// Will fail with `invalid id` if `uint256(_stake)` does not exist
			ownerOf(uint256(keccak256(abi.encode(_stake)))) == msg.sender,
			"Caller is not the owner of the SNFT"
		);

        PoolConfig memory config = configs[_stake.poolId];

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

        // If they have not passed the rewardsTime do we 
            // A) revert
            // B) successfully unstake, forfeiting rewards <-- This one, for now
            // C) successfully unstake, getting a prorated amount of rewards
        // If they have passed the rewardsTime, claim rewards and unstake

        uint256 blockDiff = block.number - _stake.stakedOrClaimedAt;
        if (address(config.rewardsToken) != address(0) && blockDiff > config.minRewardsTime) {

            uint256 rewards = config.rewardsPerBlock * blockDiff;
            _stake.stakedOrClaimedAt = 0;

            config.rewardsToken.transferFrom(
                config.rewardsVault,
                msg.sender,
                rewards
            );
        }

        // Burn the SNFT
        // TODO should this be higher in the function?
        _burn(uint256(keccak256(abi.encode(_stake))));
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
    function getAvailableRewardsBalance(bytes32 poolId) public view returns (uint256) {
        PoolConfig memory config = configs[poolId];
        return config.rewardsToken.balanceOf(config.rewardsVault);
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
    ) public  onlyAdmin onlyExists(poolId) {
        // TODO should we allow this? what if there are still stakers?
        // how will we reconcile all the existing stakes + rewards?
        // have to track every stake in every pool, if so
        // then iterate each stake in the pool being deleted and forcefully unstake each
        delete configs[poolId];
        // emit PoolDeleted(poolId, admin);
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

		// totalStakedERC20[msg.sender] += amount;

        // calc amount owed currently in rewards now
        // update block

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
		uint256 amount,
		uint256 index
	) internal {
		require(
			IERC1155(configs[poolId].stakingToken).balanceOf(msg.sender, index) != 0,
			"Must have quantity to stake when staking ERC1155"
		);

		// totalStakedERC1155[msg.sender][index] += amount;

		IERC1155(configs[poolId].stakingToken).safeTransferFrom(
			msg.sender,
			address(this),
			tokenId,
			amount,
			""
		);
	}




	// Separate main stake funcs
    /**
     * @notice Stake an NFT into a pool. Only the owner of the NFT can call to stake it.
     * Will fail if the staking pool has not been created yet.
     *
     * @param poolId The pool to stake in
     * @param tokenId The NFT to stake
     */
	// function stakeERC721(
	// 	bytes32 poolId,
	// 	uint256 tokenId
	// ) external onlyExists(poolId) onlyNFTOwner(poolId, tokenId) {
	// 	// Zero check not needed on token, as `onlyNFTOwner` will fail if it is zero
	// 	require(
	// 		configs[poolId].stakingTokenType == TokenType.IERC721,
	// 		"Pool staking token type must be IERC721"
	// 	);

	// 	bytes32 stakeId = keccak256(abi.encodePacked(poolId, tokenId, msg.sender));

	// 	require(
	// 		stakedOrClaimedAt[stakeId] == 0,
	// 		"Token already staked"
	// 	);

	// 	stakedOrClaimedAt[stakeId] = block.number;
	// 	originalStakers[stakeId] = msg.sender;

	// 	// Transfer the stakers NFT
	// 	IERC721(configs[poolId].stakingToken).transferFrom(
	// 		msg.sender,
	// 		address(this),
	// 		tokenId
	// 	);

	// 	// Mint the owner an SNFT
	// 	_mint(msg.sender, uint256(stakeId));
	// 	// TODO would 0s become misleading if grouped event?
	// 	// for 1155, index would point to what asset it was, and 0 would be valid
	// 	emit Staked(poolId, tokenId, 0, 0, msg.sender, stakeId);
	// }

	// function stakeERC20(
	// 	bytes32 poolId,
	// 	uint256 amount
	// ) external onlyExists(poolId) {
	// 	PoolConfig memory config = configs[poolId];
	// 	require(
	// 		config.stakingTokenType == TokenType.IERC20,
	// 		"Pool staking token type must be IERC20"
	// 	);
	// 	require(
	// 		amount != 0 && IERC20(config.stakingToken).balanceOf(msg.sender) >= amount,
	// 		"Amount must be non-zero and user balance must be >= amount"
	// 	);

	// 	// TODO should we keep some "amountDepositedByUser" to track total staked?
	// 	// Otherwise, we'd have to collect every stake this user ever made to calculate this
	// 	// Might be able to do this with subgraph, but it might be simpler to have here
	// 	bytes32 stakeId = keccak256(abi.encodePacked(poolId, amount, msg.sender));

	// 	stakedOrClaimedAt[stakeId] = block.number;
	// 	originalStakers[stakeId] = msg.sender; // to send back on unstake to original staker not SNFT owner
	// 	totalStakedERC20[msg.sender] += amount;

	// 	// Transfer the stakers NFT
	// 	IERC20(configs[poolId].stakingToken).transferFrom(
	// 		msg.sender,
	// 		address(this),
	// 		amount
	// 	);

	// 	// Only one SNFT per user per pool, regardless of if they contribute more to that pool
	// 	// at a later date. Claims made on rewards will be based on (total amount staked? | first stake?)
	// 	// how does claim and unstake work here?
	// 	if(!_exists(uint256(stakeId))) {
	// 		// Mint the owner an SNFT
	// 		_mint(msg.sender, uint256(stakeId));
	// 	}

	// 	emit Staked(poolId, 0, amount, 0, msg.sender, stakeId);
	// }

	// function stakeERC1155(
	// 	bytes32 poolId,
	// 	uint256 tokenId,
	// 	uint256 amount,
	// 	uint256 index
	// ) external onlyExists(poolId) onlyNFTOwner(poolId, tokenId) {
	// 	PoolConfig memory config = configs[poolId];
	// 	require(
	// 		config.stakingTokenType == TokenType.IERC1155,
	// 		"Pool staking token type must be IERC1155"
	// 	);
	// 	require(
	// 		// Index is the type of asset they are staking, so it should be > 0
	// 		IERC1155(config.stakingToken).balanceOf(msg.sender, index) != 0,
	// 		"Must have quantity to stake when staking ERC1155"
	// 	);

	// 	bytes32 stakeId = keccak256(abi.encodePacked(poolId, tokenId, amount, index, msg.sender));

	// 	require(
	// 		stakedOrClaimedAt[stakeId] == 0,
	// 		"Token already staked"
	// 	);

	// 	stakedOrClaimedAt[stakeId] = block.number;
	// 	originalStakers[stakeId] = msg.sender;

	// 	// Transfer the stakers ERC1155 token(s)
	// 	IERC1155(configs[poolId].stakingToken).safeTransferFrom(
	// 		msg.sender,
	// 		address(this),
	// 		tokenId,
	// 		amount,
	// 		abi.encodePacked(index)
	// 	);

	// 	// what if asset is fungible? how do we track the amount of the asset staked?

	// 	// Mint the owner an SNFT, if stake is unique
	// 	// e.g. if staking the same amount of a fungible asset, the stakeId will be the same
	// 	if (!_exists(uint256(stakeId))) {
	// 		_mint(msg.sender, uint256(stakeId));
	// 	} else {
	// 		// If the token exists, the user has already staked this quantity of this asset
	// 		// so we add to their total staked amount

	// 	}

	// 	// include 1155 index in emit
	// 	emit Staked(poolId, tokenId, amount, index, msg.sender, stakeId);
	// }
}
