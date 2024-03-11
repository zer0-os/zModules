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
    mapping(bytes32 poolId => StakeConfig config) public configs;

    // Mapping to track when a token was last accessed by the system
    mapping(bytes32 stakeId => uint256 blockNumber) public stakedOrClaimedAt;

    // We track the original staker of the NFT to allow the SNFT to be transferable
    // and still return the original NFT to the original staker on unstake
    mapping(bytes32 stakeId => address staker) public originalStakers;

	// Track the total amount of ERC20 tokens staked in the contract by a user
	// We use this value for rewards calculation
	mapping(address user => uint256 tokens) public totalStakedERC20;

	// Maybe its better to track individual stakes, not the total staked (or do both?)
	// is both just adding unnecessary on chain data?

	// Track the total amount of fungible assets in an ERC1155 that are staked in 
	// the contract by a user. We use this value for rewards calculation
	mapping(address user => mapping(uint256 index => uint256 amount)) public totalStakedERC1155;

	// TODO need to track ERC721 total? probably not

	constructor(
		string memory name,
		string memory symbol,
		StakeConfig[] memory _configs
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
    function createPool(StakeConfig memory _config) public onlyAdmin {
        _createPool(_config);
    }

	function _createPool(StakeConfig memory _config) internal {
		// Staking token must not be zero
		// Rewards token can optionally be 0 if there are no rewards in a pool
        require(
            address(_config.stakingToken) != address(0),
            "Staking token must not be zero"
        );

		require(
			// Enum for token types is only three 0-based options
			// so 3 or higher is an invalid token type
			uint256(_config.stakingTokenType) < 3 && uint256(_config.rewardsTokenType) < 3,
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
	 * @param salt A large random number used in hashing to make the stakeId unique
	 */
	function stake(
		bytes32 poolId,
		uint256 tokenId,
		uint256 amount,
		uint256 index,
		uint256 salt // TODO maybe bytes32 is better
    ) external onlyExists(poolId) {
		StakeConfig memory config = configs[poolId];

		// One of `tokenId` or `amount` must be non-zero
		require(
			tokenId != 0 || amount != 0,
			"Cannot create empty stake"
		);

		bytes32 stakeId = keccak256(
			abi.encodePacked(
				poolId, 
				tokenId, 
				amount, 
				index, 
				msg.sender, 
				salt
			)
		);

		require(
			stakedOrClaimedAt[stakeId] == 0,
			"Token already staked"
		);

		// Mark the initial staking block
		stakedOrClaimedAt[stakeId] = block.number;
		originalStakers[stakeId] = msg.sender;

		// Transfer appropriate tokens
		if(config.stakingTokenType == TokenType.IERC721) {
			_stakeERC721(poolId, tokenId);
		} else if(config.stakingTokenType == TokenType.IERC20) {
			_stakeERC20(poolId, amount);
		} else {
			// On pool creation we validate staking token type, so it's
			// safe to assume final case is ERC1155
			_stakeERC1155(poolId, tokenId, amount, index);
		}

        // Mint the owner an SNFT
		_mint(msg.sender, uint256(stakeId));
        
		emit Staked(poolId, tokenId, amount, index, stakeId, msg.sender);
    }

	// Q's
	// TODO why would the SNFT owner want to unstake and lose access to claiming rewards?
	// TODO should the original staker be able to unstake at any time?
	// TODO should the original staker also be able to claim, if the rewards are divided?
	// TODO should rewards be slightly higher if staker allows others to use SNFT?
	// TODO when the SNFT owner claims or unstakes, should we divide the rewards
	// between the original staker and the SNFT owner?

	/**
	 * @notice Claim rewards from a valid stake
	 * 
	 * @param poolId The pool in which the stake exists
	 * @param stakeId The unique identifier of that stake
	 */
	function claim(bytes32 poolId, bytes32 stakeId) external {
		StakeConfig	memory config = configs[poolId];
		require(
			// Will fail with `invalid id` if `uint256(stakeId)` does not exist
			ownerOf(uint256(stakeId)) == msg.sender,
			"Caller is not the owner of the SNFT"
		);

		// Confirm rewards can be claimed
		require(
			block.number - stakedOrClaimedAt[stakeId] > config.minRewardsTime,
			"Minimum time to claim rewards has not passed"
		);

		uint256 accessBlock = stakedOrClaimedAt[stakeId];
		stakedOrClaimedAt[stakeId] = block.number;

		if(config.rewardsTokenType == TokenType.IERC20) {
			uint256 rewards = config.rewardsPerBlock * (block.number - accessBlock);

			IERC20(config.rewardsVault).transfer(msg.sender, rewards);
		} else if(config.rewardsTokenType == TokenType.IERC721) {
			// TODO how do we resolve what the reward should be?
			// A) Transfer an existing token as reward
				// Assume they have a vault of existing tokens to transfer
				// How do we know the tokenId to transfer?
			// B) Call `mint` on their ERC721 contract to mint a new token as reward
				// Need to confirm they have a public `mint` and that we are allow to call
				// How do we know the ID of the token to mint?
				// Should this be `uint256(stakeId)`?
				// What about the format of the metadata, do we care?
			// C) Mint a rewards token from this contract
				// Why would that be useful to them?
		} else {
			// Similar questions to the above
			// TODO how do we resolve what the reward should be?
			// NFT? a fungible asset instead similar to ERC20?
			// some asset specific to the ERC1155 contract
				// We'd have to include `rewardsIndex` in stake config so
				// they can specify the index of the asset to use as a reward
				// then we can call `safeTransferFrom` to transfer the reward
				// but we still don't know how much to reward
					// If fungible reward asset, we can do similar to ERC20
					// if NFT is reward, we do similar to ERC721
		}
	}

    /**
     * @notice Unstake a staked NFT from a pool. Only the owner of the SNFT can call to unstake.
     * Any pending rewards accrued from the staked NFT will be transferred to the caller and
     * the original NFT will be returned to the original staker.
     *
     * @param poolId The pool where the existing stake exists
     * @param stakeId The unique identifier of the stake
     * @param tokenId The id of the token to unstake, if applicable
     * @param amount The amount of a token to unstake, if applicable // TODO remove a full stake? or X amount?
     * @param index The index of an asset to unstake, if applicable
     */
    function unstake(bytes32 poolId, bytes32 stakeId, uint256 tokenId, uint256 amount, uint256 index) external {
        // TODO maybe original NFT owner has to allow the SNFT owner to call unstake
        // otherwise the original NFT would have to resubmit to stake again if they didn't
        // want to unstake. But also maybe this is just a mechanic they have to accept as part
        // of allowing the SNFT to be transferrable
        // bytes32 stakeId = keccak256(abi.encodePacked(poolId, tokenId));

        require(
            ownerOf(uint256(stakeId)) == msg.sender,
            "Caller is not the owner of the stake token"
        );

        StakeConfig memory config = configs[poolId];

		// If they have not passed the rewardsTime, they forfeit those rewards on unstake

        // Return NFT to the original staker
		if (configs[poolId].stakingTokenType == TokenType.IERC721) {
			stakedOrClaimedAt[stakeId] = 0;
			originalStakers[stakeId] = address(0);

			IERC721(config.stakingToken).transferFrom(
				address(this),
				originalStakers[stakeId],
				tokenId
			);
		} else if (configs[poolId].stakingTokenType == TokenType.IERC20) {
			// TODO should they be able to unstake a specific amount? or just a single stake entity?
			
		} else {

		}

		_burn(uint256(stakeId));


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
        // config.rewardsToken.transfer(msg.sender, rewards);
        // emit Unstaked(poolId, tokenId, msg.sender, rewards);
    }

    /**
     * @notice Get the poolId for a given staking configuration
     * @param _config The configuration to be hashed to create the poolId
     */
    function getPoolId(
        StakeConfig memory _config
    ) public pure  returns (bytes32) {
        return _getPoolId(_config);
    }

    /**
     * @notice Get the admin of this contract
     */
    function getAdmin() public view  returns (address) {
        return admin;
    }

    /**
     * @notice Get the staking token for a given pool
     * @param poolId The pool to check
     */
    function getRewardsPerBlock(
        bytes32 poolId
    ) public view  returns (uint256) {
        return configs[poolId].rewardsPerBlock;
    }

    /**
     * @notice Get the staking token for a given pool
     * @param poolId The pool to check
     */
    function getStakingToken(
        bytes32 poolId
    ) public view  returns (address, TokenType) {
        return (configs[poolId].stakingToken, configs[poolId].stakingTokenType);
    }

    /**
     * @notice Get the rewards token for a given pool
     * @param poolId The pool to check
     */
    function getRewardsToken(
        bytes32 poolId
    ) public view  returns (address, TokenType) {
        return (configs[poolId].rewardsToken, configs[poolId].rewardsTokenType);
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
        StakeConfig memory _config
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
		// If stakes are not unique, there are two options when they stake the same amount and generate
		// the same stakeId (written before adding "salt" param above)
		// If we DONT reset the block number on stake, they can claim lots of rewards without actually staking it
		// until the very end of a stake, sort of defeating the purpose of staking
		// and if we DO, they don't get rewards for the first period before resetting block
		require(
			amount != 0,
			"Amount must be non-zero when staking ERC20"
		);

		totalStakedERC20[msg.sender] += amount;

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

		totalStakedERC1155[msg.sender][index] += amount;

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
	// 	StakeConfig memory config = configs[poolId];
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
	// 	StakeConfig memory config = configs[poolId];
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
