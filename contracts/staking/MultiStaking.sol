// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IMultiStaking } from "./IMultiStaking.sol";
import { ABaseStaking } from "./ABaseStaking.sol";


/**
	// TODO not sure what to create at constructor, if anything
 * @title MultiStaking - A contract for creating multiple staking configurations, or "pools",
 * that use various types of staking tokens and earn rewards in ERC20 tokens.
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
 */
// TODO st: 1. figure out and rework timelocks from `PoolConfig.minRewardsTime` to the other solution based on Neo's answer
//  2. rework from storing stakes in an array and just recalculate current rewards on `stake()` if previous stakes exist
contract MultiStaking is ERC721, ABaseStaking, IERC1155Receiver, IMultiStaking {
    /**
     * @notice Restrict functions to be useable only by the `admin` set on deployment
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Caller is not the admin");
        _;
    }

    modifier onlySNFTOwner(uint256 stakeNonce) {
        StakerProfile storage staker = stakers[msg.sender];

        // If `stakeNonce > staker.currentStakeNonce` below will grab a 0 stake, `ownerOf` will fail
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
            address(pools[poolId].stakingToken) != address(0),
            "Staking pool does not exist"
        );
        _;
    }

    // The operator of this contract
    address public admin;

    // Mapping to track staking configurations
    mapping(bytes32 poolId => PoolConfig config) public pools;

    // Every user maps to a StakerProfile struct
    mapping(address user => StakerProfile staker) public stakers;

	constructor(
		string memory name,
		string memory symbol,
		PoolConfig[] memory _configs
	) ERC721(name, symbol) {
		admin = msg.sender;

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
	 * @param amount The amount of tokens to stake (0 if not ERC20 pool) TODO st: should be 1 instead and we can use the same formula
	 * @param index The index of the asset to stake (0 if not ERC1155 pool)
	 */
	function stake(
		bytes32 poolId,
		uint256 tokenId,
		uint256 amount,
		uint256 index
    ) external {
        // No need to check if pool exists, a 0'd config is returned by `pools[poolId]` if
        // the pool does not exist and that will route to `_stakeERC721`, which will fail on `ownerOf`
		PoolConfig memory config = pools[poolId];

		// One of `tokenId` or `amount` must be non-zero
		require(
			tokenId != 0 || amount != 0,
			"Cannot create empty stake"
		);

        StakerProfile storage staker = stakers[msg.sender];

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
            stakedOrClaimedAt: block.timestamp
        });

        // The Nth stake is `stake`, then keep `currentStakeNonce` as incremental value
        // means we always can track all the stakes for a user without holding an array
        staker.stakesMap[staker.currentStakeNonce] = _stake;
        unchecked {
            ++staker.currentStakeNonce;
        }

        // Mint the owner an SNFT
		_mint(msg.sender, uint256(keccak256(abi.encode(_stake))));

		emit Staked(_stake, msg.sender);
    }

	/**
	 * @notice Claim rewards from a valid stake
	 *
	 * @param stakeNonce The integer number identifier of a stake for a user
	 */
	function claim(uint256 stakeNonce) external onlySNFTOwner(stakeNonce) {
        StakerProfile storage staker = stakers[msg.sender];

		Stake storage _stake = staker.stakesMap[stakeNonce];

        PoolConfig memory config = pools[_stake.poolId];

        require(
            address(config.rewardsToken) != address(0),
            "Pool does not have rewards configured"
        );

		// Confirm rewards can be claimed
        uint256 accessTime = _stake.stakedOrClaimedAt;
		require(
			block.timestamp - accessTime > config.minRewardsTime,
			"Minimum time to claim rewards has not passed"
		);

        // TODO st: we need to make sure that amount is passed as 1 and not zero,
        //      this way we don't need any if statements and can use the same function
        uint256 rewards = _calculateRewards(
            block.timestamp - accessTime,
            config.rewardWeight,
            config.rewardPeriod,
            _stake.amount
        );
        // TODO st: [REMOVE] after testing !!!!
        require(rewards > 0, "ZERO REWARDS!!!");

        // require pool has balance for transfer
        // TODO st: [REMOVE] I believe this is not necessary. we are just pulling the revert forward by 2 operations
        //  the transfer below will fail if the pool does not have enough balance
        // TODO st: this should possibly be a check of the funding of the specific pool!
        //  we may have to create balances for each pool on this contract to not spend someone else's token,
        //  unless we would let the users know that they should not share this contract between different organizations!
        //  it should be one contract per org. otherwise, if several pools use the same reward token,
        //  contract would automatically fund from somebody elses token reserves when their pool runs out.
        //  If the latter is a choice, this is not needed, since it will fail on transfer later.
        require(
            config.rewardsToken.balanceOf(address(this)) > rewards,
            "Pool does not have enough rewards"
        );

        // update block timestamp before transfer
		_stake.stakedOrClaimedAt = block.timestamp;

        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );

        // TODO st: emit claimed
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
        StakerProfile storage staker = stakers[msg.sender];

		Stake storage _stake = staker.stakesMap[stakeNonce];

        require(
            _stake.stakedOrClaimedAt != 0,
            "Stake has already been unstaked"
        );

        // Mark stake as removed
        uint256 timeDiff = block.timestamp - _stake.stakedOrClaimedAt;
        _stake.stakedOrClaimedAt = 0;

        PoolConfig memory config = pools[_stake.poolId];

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

        // If rewards are configured and the stake existed for long enough
        if (address(config.rewardsToken) != address(0) && timeDiff > config.minRewardsTime) {
            // TODO st: why is this different than the formula in claim? should it be the same formula?
            uint256 rewards = config.rewardWeight * timeDiff;

            config.rewardsToken.transfer(
                msg.sender,
                rewards
            );
        } else { // TODO st: else on which one of the above checks? looks like we need more else-ifs...
            // TODO st: if this is an "else" case and we revert, we shouldn't include rewardToken address check above.
            // Revert or allow unstake?
            // revert();
        }

        // TODO st: emit unstaked
    }

    function calculateRewards(
        uint256 timePassed,
        uint256 poolWeight,
        uint256 rewardPeriod,
        uint256 stakeAmount
    ) external view returns (uint256) {
        return _calculateRewards(timePassed, poolWeight, rewardPeriod, stakeAmount);
    }

    // TODO st: make this formula perfect, connect it to all the logic and swap this one.
    function _calculateRewards(
        uint256 timePassed,
        uint256 poolWeight,
        uint256 rewardPeriod,
        uint256 stakeAmount
    ) internal view returns (uint256) {
        // TODO st: this formula is bad and is a placeholder for now !!
        return poolWeight * stakeAmount * timePassed / rewardPeriod;
    }

    /**
     * @notice Get the poolId for a given staking configuration
     * @param _config The configuration to be hashed to create the poolId
     */
    function getPoolId(
        PoolConfig memory _config
    ) external pure returns (bytes32) {
        return _getPoolId(_config);
    }

    // View the amount of rewards in a pool remaining to be distributed to staking users
    function getAvailableRewardsForPool(bytes32 poolId) external view returns (uint256) {
        return pools[poolId].rewardsToken.balanceOf(address(this));
    }

    // Show the remaining amount of time before a staker can claim rewards
    // TODO st: is this the best way to get data for user? is this the data he would want?
    // TODO reply: Yes, I would see why the user wants this data, so they can know when they can claim rewards
    // I am not sure if this is the most optimal way to do it,  but it is a `view` function and won't cost gas
    function getRemainingTimeToClaim(uint256 stakeNonce) public view returns (uint256) {
        StakerProfile storage staker = stakers[msg.sender];
        Stake memory _stake = staker.stakesMap[stakeNonce];

        uint256 canClaimAt = _stake.stakedOrClaimedAt + pools[_stake.poolId].minRewardsTime;

        if (block.timestamp < canClaimAt) {
            return canClaimAt - block.timestamp;
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

        emit AdminSet(_admin);
    }

    // TODO st: remove this, most likely, unless there is a strong case for this
    // function deletePool(
    //     bytes32 poolId
    // ) public onlyAdmin onlyExists(poolId) {
    //     delete pools[poolId];
    //     // emit PoolDeleted(poolId, admin);
    // }

    // ERC1155Receiver implementation
    // Values from IERC1155Receiver
    // TODO st: remove these and use proper accessor - `IMultiStaking.onERC1155Received.selector`
    bytes4 private constant INTERFACE_ID_ERC1155_RECEIVED = 0xf23a6e61;
    bytes4 private constant INTERFACE_ID_ERC1155_BATCH_RECEIVED = 0xbc197c81;

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        // TODO st: `IMultiStaking.onERC1155Received.selector` instead of the below
        return INTERFACE_ID_ERC1155_RECEIVED;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        // TODO st: same here as in the `onERC1155Received()`
        return INTERFACE_ID_ERC1155_BATCH_RECEIVED;
    }

    function _getPendingRewardsForStake(uint256 stakeNonce) internal view returns (uint256) {
        StakerProfile storage staker = stakers[msg.sender];

        Stake memory _stake = staker.stakesMap[stakeNonce];
        PoolConfig memory config = pools[_stake.poolId];

        if (
            // The token is burned on unstake and non-transferable, if not the owner it's invalid
            ownerOf(uint256(keccak256(abi.encode(_stake)))) == msg.sender
            &&
            // Stake must be able to be claimed
            block.timestamp - _stake.stakedOrClaimedAt > config.minRewardsTime
        ) {

            // TODO st: formula for rewards TBD
            // move to internal function that calcs this when ready
            return config.rewardWeight * (block.timestamp - _stake.stakedOrClaimedAt);
        }

        return 0;
    }


    // TODO st: user could have multiple stakes in single pool, but we can't know which
    // stakes those are in the stake nonce, how do we do this to total for that single pool?
    // e.g. user has stakes [ 0, 1, 2, 3, 4] and stakes 0, 3, and 4 are in the same pool,
    // is the only way to sum rewards for that pool by just iterating all the stakes?
    function _getPendingRewardsForPool(bytes32 poolId) internal view returns (uint256) {
        StakerProfile storage staker = stakers[msg.sender];

        uint256 rewardsTotal;
        Stake memory _stake;
        PoolConfig memory config;

        uint256 i = 0;
        uint256 len = staker.currentStakeNonce;

        for(i; i < len;) {
            _stake = staker.stakesMap[i];
            config = pools[_stake.poolId];

            if (_stake.poolId == poolId) {
                if (
                    // The token is burned on unstake and non-transferable, if not the owner it's invalid
                    ownerOf(uint256(keccak256(abi.encode(_stake)))) == msg.sender
                    &&
                    // Stake must be able to be claimed
                    block.timestamp - _stake.stakedOrClaimedAt > config.minRewardsTime
                ) {

                    // TODO st: this should use an already written internal function
                    rewardsTotal += config.rewardWeight * (block.timestamp - _stake.stakedOrClaimedAt);
                }
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
        // TODO st: can we turn these into errors to save gas?
            "Staking token must not be zero"
        );

        // TODO st: what is the purpose of a pool like that? just storing tokens?
		// Rewards token can optionally be 0 if there are no rewards in a pool
        if (address(_config.rewardsToken) != address(0)) {
            require(
                _config.rewardWeight != 0,
                "Invalid rewards configuration"
            );
        }

		require(
			// Enum for token types is
            // 0 - ERC721
            // 1 - ERC20
            // 2 - ERC1155
			uint256(_config.stakingTokenType) <= uint256(type(TokenType).max),
			"Invalid stake or rewards token type"
		);

        bytes32 poolId = _getPoolId(_config);

        // Staking configuration must not already exist
        require(
            address(pools[poolId].stakingToken) == address(0),
            "Staking configuration already exists"
        );

        pools[poolId] = _config;
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
                    _config.rewardWeight,
					_config.minRewardsTime
                )
            );
    }

	// Stake for ERC721s, routed from main `stake` function
	function _stakeERC721(bytes32 poolId, uint256 tokenId) internal {
        // TODO st: do we need this? if a user is not the owner, any transfer or approve call will fail anyway. is that true?
        //  also, this is the exact same code as in the modifier above.
        require(
			IERC721(pools[poolId].stakingToken).ownerOf(tokenId) == msg.sender,
			"Caller is not the owner of the NFT to stake"
		);

		// Transfer the stakers NFT
		IERC721(pools[poolId].stakingToken).transferFrom(
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
		IERC20(pools[poolId].stakingToken).transferFrom(
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
        // TODO st: test confirm balance
        // TODO st: do we need any checks here?
		IERC1155(pools[poolId].stakingToken).safeTransferFrom(
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
