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
    mapping(uint256 tokenId => Stake stakeData) public stakedOrClaimedAt;
    // TODO can likely be single var not struct

    /**
	 * @dev Throw when the caller is not the owner of the given token
	 */
    error InvalidOwner();

	/**
	 * @dev Restrict calls to be only from the sNFT owner
	 */
    modifier onlySNFTOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner();
        }
        _;
    }

    modifier onlyUnlocked(uint256 tokenId) {
        // If we use a single value for `stakedOrClaimedAt`, when the timestamp is updated it's possible this
        // throws, we need to compare original stake timestamp only
        if (config.timeLockPeriod > block.timestamp - stakedOrClaimedAt[tokenId].stakeTimestamp) {
            revert TimeLockNotPassed();
        }
        _;
    }

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
        if (IERC721(config.stakingToken).ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner();
        }
        _stake(tokenId);
    }

	/**
	 * @notice Stake multiple ERC721 tokens and receive non-transferable ERC721 tokens in return
	 * @param tokenIds The tokenIds of the ERC721 staking token contracts
	 */
    function stakeBulk(uint256[] calldata tokenIds) external {
        uint i;
        uint len = tokenIds.length;
        for (i; i < len;) {
            if (IERC721(config.stakingToken).ownerOf(tokenIds[i]) != msg.sender) {
                revert InvalidOwner();
            }
            _stake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }
    }

	/**
	 * @notice Claim rewards for a staked ERC721 token
	 * @dev Will revert if the time lock period has not been met
	 * @param tokenId The tokenId of the ERC721 staking token contract
	 */
    function claim(uint256 tokenId) external {
        _claimOrUnstake(tokenId, false);
    }

	/**
	 * @notice Claim rewards for multiple staked ERC721 tokens
     * @dev Will revert if the time lock period has not been met
	 * @param tokenIds The tokenIds of the ERC721 staking token contracts
	 */
    function claimBulk(uint256[] calldata tokenIds) external {
        _claimOrUnstakeBulk(tokenIds, false);
    }

    /**
     * @notice Unstake a token and receive rewards
     * @dev Will revert if the time lock period has not been met
     * @param tokenId The tokenId of the ERC721 staking token contract
     */
    function unstake(uint256 tokenId) external {
        _claimOrUnstake(tokenId, true);
    }

    function unstakeBulk(uint256[] calldata tokenIds) external {
        _claimOrUnstakeBulk(tokenIds, true);
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance() external view returns (uint256) {
        return config.rewardsToken.balanceOf(address(this));
    }

    /**
     * @notice View the pending rewards balance for a staked token
     * @param tokenId The tokenId of the ERC721 staking token contract
     */
    function getPendingRewards(uint256 tokenId) external view returns (uint256) { // TODO make view
        Stake memory stake_ = stakedOrClaimedAt[tokenId];
        uint256 accessTime = stake_.claimTimestamp == 0 ? stake_.stakeTimestamp : stake_.claimTimestamp;

        return _calculateRewards(
            block.timestamp - accessTime,
            1,
            config
        );
    }

    /**
     * @notice View pending rewards for all given tokens
     * @param tokenIds The tokenIds of the ERC721 staking token contracts
     */
    function getPendingRewardsBulk(uint256[] calldata tokenIds) external view returns (uint256) { // TODO make view
        uint256 i;
        uint256 len = tokenIds.length;
        uint256 totalRewards;

        for (i; i < len;) {
            Stake memory stake_ = stakedOrClaimedAt[tokenIds[i]];
            uint256 accessTime = stake_.claimTimestamp == 0 ? stake_.stakeTimestamp : stake_.claimTimestamp;

            totalRewards += _calculateRewards(
                block.timestamp - accessTime,
                1,
                config
            );

            unchecked {
                ++i;
            }
        }

        return totalRewards;
    }

    /**
     * @notice Return the time, in seconds, remaining for a stake to be claimed or unstaked
     * @param tokenId The tokenId of the ERC721 staking token contract
     */
    function getRemainingLockTime(uint256 tokenId) external view returns (uint256) {
        // Return the time remaining for the stake to be claimed or unstaked
        uint256 timePassed = block.timestamp - stakedOrClaimedAt[tokenId].stakeTimestamp;
        if (timePassed > config.timeLockPeriod) {
            return 0;
        }
        return config.timeLockPeriod - timePassed;
    }

    /**
	 * @notice Remove a stake from the pool without consideration for time lock period
	 * or for rewards. This is a last resort function for users to remove their stake
	 * in the case the a pool is abandoned by the owner, is not funded, or they simply
	 * want to withdraw their stake.
     * @dev This will fail if the caller is not the owner of the sNFT
	 * @param tokenId The tokenId of the ERC721 staking token contract
	 */
    function exitWithoutRewards(uint256 tokenId) external {
        _exitWithoutRewards(tokenId);
    }

	/**
	 * @notice Remove stakes from the pool without consideration for time lock period
	 * or for rewards. This is the same as `exitWithoutRewards` but for multiple tokens.
     * @dev This will fail if the caller is not the owner of the sNFT
	 * @param tokenIds Array of tokenIds from the ERC721 staking token contracts
	 */
    function exitWithoutRewardsBulk(uint256[] calldata tokenIds) external {
        uint256 i;
        uint256 len = tokenIds.length;
        for (i; i < len;) {
            if (ownerOf(tokenIds[i]) != msg.sender) {
                revert InvalidOwner();
            }
            _exitWithoutRewards(tokenIds[i]);

            unchecked {
                ++i;
            }
        }
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _stake(uint256 tokenId) internal {
        // Mark when the token was staked
        stakedOrClaimedAt[tokenId].stakeTimestamp = block.timestamp;

        // Transfer the NFT to this contract
        IERC721(config.stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Mint user sNFT
        _mint(msg.sender, tokenId);

        emit Staked(tokenId, 1, 0, config.stakingToken);
    }

    function _claimOrUnstake(
        uint256 tokenId,
        bool isUnstake
    ) public onlySNFTOwner(tokenId) onlyUnlocked(tokenId) {
        Stake memory stake_ = stakedOrClaimedAt[tokenId];

        uint256 accessTime = stake_.claimTimestamp == 0 ? stake_.stakeTimestamp : stake_.claimTimestamp;

        uint256 rewards = _calculateRewards(
            block.timestamp - accessTime,
            1,
            config
        );

        if (isUnstake) {
            // Update timestamp to unstaked
            stakedOrClaimedAt[tokenId].stakeTimestamp = 0;

            // Burn the sNFT
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
                rewards,
                config.stakingToken
            );
        } else {
            // Mark the most recent claim timestamp
            stakedOrClaimedAt[tokenId].claimTimestamp = block.timestamp;
            emit Claimed(tokenId, rewards, config.rewardsToken);
        }

        // This will cover if all tokens are not owned by the caller
        if (rewards == 0) {
            // TODO test this case somehow??
            revert NoRewards();
        }

        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );
    }
    function _claimOrUnstakeBulk(
        uint256[] calldata tokenIds,
        bool isUnstake
    ) public  {
        // Start rewards count to include any pendingRewards already accrued
        uint256 rewards;

        uint i;
        uint len = tokenIds.length;
        for (i; i < len;) {
            // onlySNFTOwner(tokenId) onlyUnlocked(tokenId)
            if (ownerOf(tokenIds[i]) != msg.sender) {
                revert InvalidOwner();
            }

            if (config.timeLockPeriod > block.timestamp - stakedOrClaimedAt[tokenIds[i]].stakeTimestamp) {
                revert TimeLockNotPassed();
            }

            Stake memory stake_ = stakedOrClaimedAt[tokenIds[i]];

            uint256 accessTime = stake_.claimTimestamp == 0 ? stake_.stakeTimestamp : stake_.claimTimestamp;

            uint256 tempRewards = _calculateRewards(
                block.timestamp - accessTime,
                1,
                config
            );

            // If we are unstaking, burn the sNFT and return the NFT as well
            if (isUnstake) {                    
                // Update timestamp to unstaked
                stakedOrClaimedAt[tokenIds[i]].stakeTimestamp = 0;

                // Burn the sNFT
                _burn(tokenIds[i]);

                // Return NFT to staker
                IERC721(config.stakingToken).safeTransferFrom(
                    address(this),
                    msg.sender,
                    tokenIds[i]
                );

                emit Unstaked(
                    tokenIds[i],
                    1,
                    0,
                    tempRewards,
                    config.stakingToken
                );
            } else {
                // Mark the most recent claim timestamp
                stakedOrClaimedAt[tokenIds[i]].claimTimestamp = block.timestamp;
                emit Claimed(tokenIds[i], tempRewards, config.rewardsToken);
            }

            rewards += tempRewards;

            unchecked {
                ++i;
            }
        }
		
		// This will also cover if all tokens are not owned by the caller
        if (rewards == 0) {
            // TODO test this case somehow
            revert NoRewards();
        }

        // Transfer all rewards at once
        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );
    }

    // function _unstake(uint256 tokenId) internal onlySNFTOwner(tokenId) onlyUnlocked(tokenId) {
    //     _claimOrUnstake(tokenId, true);
    // }

    function _exitWithoutRewards(uint256 tokenId) internal onlySNFTOwner(tokenId) {
        IERC721(config.stakingToken).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );
        _burn(tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256, 
        uint256
    ) internal pure override {
        require(
			from == address(0) || to == address(0),
			"ERC721Untransferable: token is untransferrable"
		);
    }
}