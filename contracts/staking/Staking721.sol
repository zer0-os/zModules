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

    // TODO make struct a set of single variables instead 

    // TODO destructors?
    // immutable constant endDate so company commits to certain amount of rewards

    /**
	 * @dev Track for each stake when it was most recently accessed
	 */
    // mapping(uint256 tokenId => Staker stake) public stakes;
    mapping(address staker => Staker stakerData) public stakers;

    modifier onlySNFTOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner();
        }
        _;
    }

    // mapping(uint256 tokenId => address staker) public stakerOf;

    // We need to be able to get all token Ids for a user
    // we also need to be able to get the total number of tokens staked for balances
    // if we can reliably keep a array that can be modified without a gap, then it could be okay

    constructor(
		string memory name,
		string memory symbol,
		Types.PoolConfig memory _config
	) ERC721NonTransferable(name, symbol) {
        _createPool(_config);
        config = _config;
	}

	/**
	 * @notice Stake one or more ERC721 tokens and receive non-transferable ERC721 tokens in return
	 * @param tokenIds The tokenIds of the ERC721 staking token contracts
	 */
    function stake(uint256[] calldata tokenIds) external {
        Staker storage staker = stakers[msg.sender];

        // TODO form as `_ifRewards` func to make DRY
        // Not their first stake, snapshot pending rewards
        if (staker.numStaked > 0) {
            // Update pending rewards with new calculated amount + already existing pending rewards
            staker.pendingRewards = _getPendingRewards(staker);
        } else {
            // Log the time at which this stake becomes claimable or unstakable
            // This is only done once per user
            staker.unlockTimestamp = block.timestamp + config.timeLockPeriod;
        }

        uint256 i;
        uint256 len = tokenIds.length;
        for (i ; i < len;) {
            // Append to staker's tokenIds array
            _stake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }
		staker.numStaked += len;
        staker.lastUpdatedTimestamp = block.timestamp;
    }

	/**
	 * @notice Claim rewards for all staked ERC721 tokens
     * @dev Will revert if the time lock period has not been met
	 */
    function claim() external {
        Staker storage staker = stakers[msg.sender];
        _claim(staker);
    }

    function unstake(uint256[] memory tokenIds, bool exit) external {
        Staker storage staker = stakers[msg.sender];

        if (!exit) {
            _claim(staker);
        }

        uint256 i;
        uint256 len = tokenIds.length;

        for (i; i < len;) {
            uint256 tokenId = tokenIds[i];
            // TokenId will already be 0 if it was unstaked individually
            _unstake(tokenId, staker);

            unchecked {
                ++i;
            }
        }

        // if `len > numStaked` it will have already failed above
        // don't need to check here
        staker.numStaked -= len;
        staker.lastUpdatedTimestamp = block.timestamp;
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
        return _getPendingRewards(stakers[msg.sender]);
    }

    /**
     * @notice Return the time, in seconds, remaining for a stake to be claimed or unstaked
     */
    function getRemainingLockTime() external view returns (uint256) {
        // Return the time remaining for the stake to be claimed or unstaked
        Staker storage staker = stakers[msg.sender];
        if (block.timestamp > staker.unlockTimestamp) {
            return 0;
        }

        return staker.unlockTimestamp - block.timestamp;
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _getPendingRewards(Staker storage staker) internal view returns (uint256) {
        // Mark when the token was staked
        return _calculateRewards(
            block.timestamp - staker.lastUpdatedTimestamp,
            staker.numStaked, 
            config
        ) + staker.pendingRewards;
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

    function _unstake(uint256 tokenId, Staker storage staker) internal onlySNFTOwner(tokenId) {
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
}
