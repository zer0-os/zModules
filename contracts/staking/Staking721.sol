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
    mapping(address staker => Stake stake) public stakes;

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
        Stake storage staker = stakes[msg.sender];

        // Not their first stake, snapshot pending rewards
        if (staker.numStaked > 0) { 
            // Update pending rewards with new calculated amount + already existing pending rewards
            staker.pendingRewards = _getPendingRewards(staker);
        } else {
            // Log the time at which this stake becomes claimable or unstakable
            // This is only done once per user
            staker.unlockTimestamp = block.timestamp + config.timeLockPeriod;
        }

        // Append to staker's tokenIds array
        staker.numStaked += 1;
        staker.tokenIds.push(tokenId);

        _stake(tokenId);

        staker.lastUpdatedTimestamp = block.timestamp;
    }

	/**
	 * @notice Stake multiple ERC721 tokens and receive non-transferable ERC721 tokens in return
	 * @param tokenIds The tokenIds of the ERC721 staking token contracts
	 */
    function stakeBulk(uint256[] calldata tokenIds) external {
        Stake storage staker = stakes[msg.sender];

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
            staker.tokenIds.push(tokenIds[i]);

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
        Stake storage staker = stakes[msg.sender];
        _claim(staker);
    }

    /**
     * @notice Unstake a token and receive rewards
     * @dev Will revert if the time lock period has not been met
     * @param tokenId The tokenId of the ERC721 staking token contract
     */
    // if exit is true, dont claim
    function unstake(uint256 tokenId, bool exit) external {
        Stake storage staker = stakes[msg.sender];

        // either grab staker object out here and pass to each internal
        // function, or each internal function grabs it on its own
        // in the latter case, it's duplicative
        if (!exit) {
            _claim(staker);
        }

        _unstake(tokenId, staker);
    }

    function showAll() external view returns (uint256) {
        return stakes[msg.sender].numStaked;
    }

    function unstakeAll(bool exit) external {
        Stake storage staker = stakes[msg.sender];

        if (!exit) {
            _claim(staker);
        }

        uint256 i;
        uint256 len = staker.numStaked;
        for (i; i < len;) {
            uint256 tokenId = staker.tokenIds[i];

            // Token might be 0x0 if they already unstaked it individually

            // TODO we might have to keep stake data as { tokenId, index } pairs
            // to be able to assure we always unstake the correct one
            // and if they call unstakeAll after previously doing a regular unstake, we can
            // skip it and not try to unstake a duplicative one
            // we still need correct token ids for transfer backward, have to have this
            if (tokenId != 0) {
                _unstake(tokenId, staker);
            }

            unchecked {
                ++i;
            }
        }
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
        Stake memory staker = stakes[msg.sender];
        if (block.timestamp > staker.unlockTimestamp) {
            return 0;
        }

        return staker.unlockTimestamp - block.timestamp;
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _getPendingRewards(Stake memory staker) internal view returns (uint256) {
        // Mark when the token was staked
        return _calculateRewards(
            block.timestamp - staker.lastUpdatedTimestamp,
            staker.tokenIds.length,
            config
        ) + staker.pendingRewards;
    }

    function _stake(uint256 tokenId) internal {
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

    function _claim(Stake storage staker) internal {
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

        // calc rewards if necessary
        // if so, capture pending rewards
        // save timelock and also last access point
        // safetransfer
        // update last updated timestamp after transfer 

    // always claim all of users rewards
    

    // unstake single
    // public unstake can have bool for `exit` that determines whether or not we also claim
    function _unstake(uint256 tokenId, Stake storage staker) internal {
        // Require the time lock to have passed
        _onlyUnlocked(staker.unlockTimestamp);

        // Mark as removed
        // TODO will this shrink memory accordingly or just mark as 0?
        // off by one, stake of token "1" is at 0, etc.
        // delete staker.tokenIds[tokenId]; // uses tokenId as index not value here
        // this matches on index, not on tokenId value
        staker.numStaked -= 1;

        // Burn the sNFT
        // need SNFT still? maybe let them keep it like uniswap?
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

    // Because everything is mapped by address now, we dont need this
    // any user will only ever be able to access their own stakes
    // function _onlySNFTOwner(uint256 tokenId) internal view {
    //     if (ownerOf(tokenId) != msg.sender) {
    //         revert InvalidOwner();
    //     }
    // }

    function _onlyUnlocked(uint256 unlockTimestamp) internal view {
        // User is not staked or has not passed the time lock
        if (unlockTimestamp == 0 || unlockTimestamp > block.timestamp) {
            revert TimeLockNotPassed();
        }
    }
}

    // unstakeBulk calls above in loop
    // function _unstakeAll() internal

    // former modifiers

    // function _exitWithoutRewards(uint256 tokenId) internal {
    //     IERC721(config.stakingToken).safeTransferFrom(
    //         address(this),
    //         msg.sender,
    //         tokenId
    //     );
    //     _burn(tokenId);
    // }
























    // function _claimOrUnstake(
    //     uint256 tokenId,
    //     bool isUnstake
    // ) public {
    //     Stake memory stake_ = stakedOrClaimedAt[tokenId];

    //     uint256 accessTime = stake_.claimTimestamp == 0 ? stake_.stakeTimestamp : stake_.claimTimestamp;

    //     uint256 rewards = _calculateRewards(
    //         block.timestamp - accessTime,
    //         1,
    //         config
    //     );

    //     if (isUnstake) {
            
    //     } else {
    //         // Mark the most recent claim timestamp
    //         stakedOrClaimedAt[tokenId].claimTimestamp = block.timestamp;
    //         emit Claimed(tokenId, rewards, config.rewardsToken);
    //     }

    //     // This will cover if all tokens are not owned by the caller
    //     if (rewards == 0) {
    //         // TODO test this case somehow??
    //         revert NoRewards();
    //     }

    //     config.rewardsToken.transfer(
    //         msg.sender,
    //         rewards
    //     );
    // }

    // function _claimOrUnstakeBulk(
    //     uint256[] calldata tokenIds,
    //     bool isUnstake
    // ) public  {
    //     // Start rewards count to include any pendingRewards already accrued
    //     uint256 rewards;

    //     uint i;
    //     uint len = tokenIds.length;
    //     for (i; i < len;) {
    //         if (ownerOf(tokenIds[i]) != msg.sender) {
    //             revert InvalidOwner();
    //         }

    //         if (config.timeLockPeriod > block.timestamp - stakedOrClaimedAt[tokenIds[i]].stakeTimestamp) {
    //             revert TimeLockNotPassed();
    //         }

    //         Stake memory stake_ = stakedOrClaimedAt[tokenIds[i]];

    //         uint256 accessTime = stake_.claimTimestamp == 0 ? stake_.stakeTimestamp : stake_.claimTimestamp;

    //         uint256 tempRewards = _calculateRewards(
    //             block.timestamp - accessTime,
    //             1,
    //             config
    //         );

    //         // If we are unstaking, burn the sNFT and return the NFT as well
    //         if (isUnstake) {                    
    //             // Update timestamp to unstaked
    //             stakedOrClaimedAt[tokenIds[i]].stakeTimestamp = 0;

    //             // Burn the sNFT
    //             _burn(tokenIds[i]);

    //             // Return NFT to staker
    //             IERC721(config.stakingToken).safeTransferFrom(
    //                 address(this),
    //                 msg.sender,
    //                 tokenIds[i]
    //             );

    //             emit Unstaked(
    //                 tokenIds[i],
    //                 1,
    //                 0,
    //                 tempRewards,
    //                 config.stakingToken
    //             );
    //         } else {
    //             // Mark the most recent claim timestamp
    //             stakedOrClaimedAt[tokenIds[i]].claimTimestamp = block.timestamp;
    //             emit Claimed(tokenIds[i], tempRewards, config.rewardsToken);
    //         }

    //         rewards += tempRewards;

    //         unchecked {
    //             ++i;
    //         }
    //     }
		
	// 	// This will also cover if all tokens are not owned by the caller
    //     if (rewards == 0) {
    //         revert NoRewards();
    //     }

    //     // Transfer all rewards at once
    //     config.rewardsToken.transfer(
    //         msg.sender,
    //         rewards
    //     );
    // }

    // function _unstake(uint256 tokenId) internal onlySNFTOwner(tokenId) onlyUnlocked(tokenId) {
    //     _claimOrUnstake(tokenId, true);
    // }