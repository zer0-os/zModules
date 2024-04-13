// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721NonTransferable } from "../tokens/ERC721NonTransferable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Types } from "./Types.sol";
import { StakingPool } from "./StakingPool.sol";
import { IStaking } from "./IStaking.sol";

/**
 * @title Staking721
 * @notice A staking contract that allows depositing ERC721 tokens and mints a 
 * non-transferable ERC721 token in return as representation of the deposit. 
 */
contract StakingERC721 is ERC721NonTransferable, StakingPool, IStaking {
    /**
	 * @dev The configuration of this staking pool
	 */
	Types.PoolConfig public config;

    /**
	 * @dev Track for each stake when it was most recently accessed
	 */
    // mapping(uint256 tokenId => Stake stake) public stakes;
    mapping(address staker => Staker stake) public stakes;

	// mapping(address staker => uint256 totalStaked) public totalStaked;
	mapping(address staker => mapping(uint256 index => uint256 tokenId)) public tokenIds;

	// mapping(address staker => uint256[] tokenIds) public tokenIds
	// index in the users array of staked tokens
	// mapping(uint256 tokenId => uint256 index) public indices;

    constructor(
		string memory name,
		string memory symbol,
		Types.PoolConfig memory _config
	) ERC721NonTransferable(name, symbol) {
        _createPool(_config);
        config = _config;
	}

	/**
	 * @notice Stake an ERC721 token and receive a non-transferable ERC721 token
	 * @param tokenId The tokenId of the ERC721 staking token contract
	 */
    function stake(uint256 tokenId) external {
        Staker storage staker = stakes[msg.sender];

		// Accrue rewards, if necessary
        _ifRewards(staker);

        _stake(tokenId);

		tokenIds[msg.sender][staker.numStaked] = tokenId;		
		unchecked {
			++staker.numStaked;
		}
    }

	/**
	 * @notice Stake multiple ERC721 tokens and receive non-transferable ERC721 tokens in return
	 * @param tokenIds The tokenIds of the ERC721 staking token contracts
	 */
    function stakeBulk(uint256[] calldata tokenIds) external {
        Staker storage staker = stakes[msg.sender];

		// Accrue rewards, if necessary
        _ifRewards(staker);

        uint256 i;
        uint256 len = tokenIds.length;
        for (i ; i < len;) {
            // Append to staker's tokenIds array
            _stake(tokenIds[i]);
            staker.tokenIds.push(tokenIds[i]);

            unchecked {
                ++i;
            }
        }
		staker.numStaked += len;
        staker.lastUpdatedTimestamp = block.timestamp;
    }

	function _ifRewards(Staker storage staker) internal {
		if (staker.lastUpdatedTimestamp > 0) {
			// Update pending rewards with new calculated amount + already existing pending rewards
			staker.pendingRewards = _getPendingRewards(staker);
		} else {
			// Log the time at which this stake becomes claimable or unstakable
			// This is only done once per user
			staker.unlockTimestamp = block.timestamp + config.timeLockPeriod;
			staker.lastUpdatedTimestamp = block.timestamp;
		}
	}

	/**
	 * @notice Claim rewards for all staked ERC721 tokens
     * @dev Will revert if the time lock period has not been met
	 */
    function claim() external {
        Staker storage staker = stakes[msg.sender];
        _claim(staker);
    }

    /**
     * @notice Unstake a token and receive rewards
     * @dev Will revert if the time lock period has not been met
     * @param tokenId The tokenId of the ERC721 staking token contract
     */
    // if exit is true, dont claim
    function unstake(uint256 tokenId, bool exit) external {
        Staker storage staker = stakes[msg.sender];

        if (!exit) {
            _claim(staker);
        }

		unchecked {
			--staker.numStaked;
		}

        _unstake(tokenId, staker);
    }

	// temp debug
    function showAll() external view returns (uint256[] memory) {
        return stakes[msg.sender].tokenIds;
    }

    function unstakeAll(bool exit) external {
        Staker storage staker = stakes[msg.sender];

        if (!exit) {
            _claim(staker);
        }

        uint256 i;
        uint256 len = staker.tokenIds.length;
        for (i; i < len;) {
            uint256 tokenId = staker.tokenIds[i];

            // If the sNFT was already burned individually from unstaking, it will not exist
            if (_exists(tokenId)) {
                _unstake(tokenId, staker);
            }

            unchecked {
                ++i;
            }
        }

		staker.numStaked = 0;
		staker.unlockTimestamp = 0;
		staker.lastUpdatedTimestamp = 0;
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance() external view returns (uint256) {
        return config.rewardsToken.balanceOf(address(this));
    }

    /**
     * @notice View the pending rewards balance for a user
     */
    function getPendingRewards() external view returns (uint256) { // TODO make view
        return _getPendingRewards(stakes[msg.sender]);
    }

    /**
     * @notice Return the time, in seconds, remaining for a stake to be claimed or unstaked
     */
    function getRemainingLockTime() external view returns (uint256) {
        // Return the time remaining for the stake to be claimed or unstaked
        Staker memory staker = stakes[msg.sender];
        if (block.timestamp > staker.unlockTimestamp) {
            return 0;
        }

        return staker.unlockTimestamp - block.timestamp;
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _getPendingRewards(
		Staker memory staker
	) internal view returns (uint256) {
        // If the lastUpdatedTimestamp is 0, they have are not staked
		// so dont they dont get rewards
		if (staker.lastUpdatedTimestamp == 0) {
			return 0;
		} else {
			return _calculateRewards(
				block.timestamp - staker.lastUpdatedTimestamp,
				staker.numStaked,
				config
			) + staker.pendingRewards;
		}
    }

    function _stake(
		uint256 tokenId
	) internal {
        // Transfer their NFT to this contract
        IERC721(config.stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Mint user sNFT
        _mint(msg.sender, tokenId);

        emit Staked(tokenId, 1, 0, config.stakingToken);
    }

    function _claim(
		Staker storage staker
	) internal {
        // Require the time lock to have passed
        _onlyUnlocked(staker.unlockTimestamp);

        // Returns the calculated rewards since the last time stamp + pending rewards
        uint256 rewards = _getPendingRewards(staker);

        staker.lastUpdatedTimestamp = block.timestamp;
        staker.pendingRewards = 0;

        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );

        emit Claimed(rewards, config.rewardsToken);
    }


	event Debug(
		uint256 tokenId,
		address owner
	);

    function _unstake(
		uint256 tokenId,
		Staker storage staker
	) internal  {
        // Require the time lock to have passed
		if (ownerOf(tokenId) != msg.sender) {
			// revert InvalidOwner();
			emit Debug(tokenId, ownerOf(tokenId));
			return;
			// will throw if transfer happens
			// and the token still exists in their array
			// need to fundamentally fix the array instead
		}

        _onlyUnlocked(staker.unlockTimestamp);

        _burn(tokenId);

        // Return NFT to staker
        IERC721(config.stakingToken).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Unstaked(
            tokenId,
            1,
            0,
            config.stakingToken
        );
    }

    function _onlyUnlocked(uint256 unlockTimestamp) internal view {
		// User is not staked or has not passed the time lock
        if (unlockTimestamp == 0 || block.timestamp < unlockTimestamp) {
            revert TimeLockNotPassed();
        }
    }

	function _onlySNFTOwner(uint256 tokenId) internal view {
		
	}
}
