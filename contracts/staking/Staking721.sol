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
contract Staking721 is ERC721NonTransferable, StakingPool, IStaking {
    /**
	 * @dev The configuration of this staking pool
	 */
	Types.PoolConfig public config;

    /**
	 * Track number of stakes for a user with their stake nonce
	 */
    mapping(address user => uint256 currentStakeNonce) public stakeNonces;

    /**
	 * @dev Rewards tallied to the user for additional stakes to be claimed
	 */
    mapping(address user => uint256 rewards) public rewardsOwed;

    /**
	 * @dev Track for each stake when it was most recently accessed
	 */
    mapping(uint256 tokenId => uint256 blockNumber) public stakedOrClaimedAt;

    /**
	 * @dev Throw when the caller is not the owner of the given token
	 */
    error InvalidOwner(string message);

    /**
	 * @dev Throw when caller is unable to claim rewards
	 */
    error InvalidClaim(string message);

	/**
	 * @dev Restrict calls to be only from the original NFT owner
	 */
    modifier onlyNFTOwner(uint256 tokenId) {
        if (IERC721(config.stakingToken).ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner("Staking721: Caller is not the owner of the token");
        }
        _;
    }

	/**
	 * @dev Restrict calls to be only from the sNFT owner
	 */
    modifier onlySNFTOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner("Caller is not the owner of the representative stake token");
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
            _stake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }
    }

    // TODO
    // claimBulk
    // unstakeBulk
    // TODO onlysnftowner in bulk funcs


	// Temp debug for calcs
    function showValues (uint256 tokenId) public view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        return _showValues(
            block.timestamp - stakedOrClaimedAt[tokenId],
            1,
            config
        );
    }

    function showValues2(uint256 tokenId) public view returns (uint256, bool) {
        return _showValues2(
            block.timestamp - stakedOrClaimedAt[tokenId],
            config
        );
    }

	/**
	 * @notice Claim rewards for a staked ERC721 token
	 * @dev Will revert if the time lock period has not been met or 
	 * the caller is not the owner of the sNFT.
	 * @param tokenId The tokenId of the ERC721 staking token contract
	 */
    function claim(uint256 tokenId) external onlySNFTOwner(tokenId) {
        uint256 rewards = _calculateRewards(
            block.timestamp - stakedOrClaimedAt[tokenId],
            1,
            config
        );

        // `_calculateRewards` will return 0 if the time lock period is not met
        if (rewards == 0) {
            revert InvalidClaim("Staking721: No rewards to claim");
        }

        // Update timestamp before transfer
		stakedOrClaimedAt[tokenId] = block.timestamp;

		// Rewards are valid, transfer to user
        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );

        emit Claimed(rewards, msg.sender);
    }

	/**
	 * @notice Claim rewards for multiple staked ERC721 tokens
	 * @param tokenIds The tokenIds of the ERC721 staking token contracts
	 */
    function claimBulk(uint256[] calldata tokenIds) external {
        uint i;
        uint256 rewards;
        uint len = tokenIds.length;
        for (i; i < len;) {
            // If they are not the owner of the sNFT, skip this tokenId
            if (ownerOf(tokenIds[i]) != msg.sender) {
                continue;
            }

            // _calculateRewards will return 0 if the time lock period is not met
            uint256 tempRewards = _calculateRewards(
                block.timestamp - stakedOrClaimedAt[tokenIds[i]],
                1,
                config
            );

            // If there are rewards to be claimed, mark that token as claimed
            if (tempRewards > 0) {
                rewards += tempRewards;
                stakedOrClaimedAt[tokenIds[i]] = block.timestamp;
            }

            unchecked {
                ++i;
            }
        }
		
		// If there are no rewards to claim, revert
		// This will also cover if all tokens are not owned by the caller
        if (rewards == 0) {
            revert InvalidClaim("Staking721: No rewards to claim");
        }

        // Transfer all rewards at once
        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );

        emit Claimed(rewards, msg.sender);
    }

    function unstake(uint256 tokenId) external onlySNFTOwner(tokenId) {
        uint256 rewards = _calculateRewards(
            block.timestamp - stakedOrClaimedAt[tokenId],
            1,
            config
        );

        // `_calculateRewards` will return 0 if the time lock period is not met
        if (rewards == 0) {
            revert InvalidClaim("Staking721: Unable to unstake");
        }

        // Update timestamp to unstaked
		stakedOrClaimedAt[tokenId] = 0;

        // Burn the sNFT
        _burn(tokenId);

        // Send final rewards to staker
        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );

        // Return NFT to staker
        IERC721(config.stakingToken).transferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Unstaked(tokenId, 0, 0, config.stakingToken, msg.sender);
    }

    // In the case that a pool is abandoned or no longer has funds for rewards, allow
    // users to unstake their tokens with no consideration for time lock period
	/**
	 * @notice Remove a stake from the pool without consideration for time lock period
	 * or for rewards. This is a last resort function for users to remove their stake
	 * in the case the a pool is abandoned by the owner, is not funded, or they simply
	 * want to withdraw their stake.
	 * @param tokenId The tokenId of the ERC721 staking token contract
	 */
    function removeStake(uint256 tokenId) external onlySNFTOwner(tokenId){
        _removeStake(tokenId);
    }

	/**
	 * @notice Remove stakes from the pool without consideration for time lock period
	 * or for rewards. This is the same as `removeStake` but for multiple tokens.
	 * @param tokenIds Array of tokenIds from the ERC721 staking token contracts
	 */
    function removeStakeBulk(uint256[] calldata tokenIds) external {
        uint256 i;
        uint256 len = tokenIds.length;
        for (i; i < len;) {
            if (ownerOf(tokenIds[i]) != msg.sender) {
                revert InvalidOwner("Caller is not the owner of the representative stake token");
            }
            _removeStake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }
    }

    // View the balance of this pool in the reward token
    function viewRewardsInPool() external view returns (uint256) {
        return IERC20(config.rewardsToken).balanceOf(address(this));
    }

    // view available rewards waiting to be claimed for a user
    function viewPendingRewards(uint256 tokenId) external view returns (uint256) {
        return _calculateRewards(
            block.timestamp - stakedOrClaimedAt[tokenId],
            1,
            config
        );
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

	// TODO move this below
    function _stake(uint256 tokenId) internal onlyNFTOwner(tokenId) {
        // Accrue rewards if they have staked before
        if (stakeNonces[msg.sender] != 0) {
            rewardsOwed[msg.sender] += _calculateRewards(
                block.timestamp - stakedOrClaimedAt[tokenId],
                1,
                config
            );
        }

        unchecked {
            ++stakeNonces[msg.sender];
        }

        // Mark when the token was staked
        stakedOrClaimedAt[tokenId] = block.timestamp;

        // Transfer the NFT to this contract
        IERC721(config.stakingToken).transferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Mint user sNFT
        _mint(msg.sender, tokenId);

        emit Staked(tokenId, 0, 0, config.stakingToken, msg.sender);
    }

    function _removeStake(uint256 tokenId) internal {
        IERC721(config.stakingToken).transferFrom(
            address(this),
            msg.sender,
            tokenId
        );
        _burn(tokenId);
    }
}