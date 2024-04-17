// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721NonTransferrable } from "../tokens/ERC721NonTransferrable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { StakingPool } from "./StakingPool.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";

/**
 * @title Staking721
 * @notice A staking contract that allows depositing ERC721 tokens and mints a 
 * non-transferable ERC721 token in return as representation of the deposit. 
 */
contract StakingERC721 is ERC721NonTransferrable, StakingPool, IStakingERC721 {
    /**
     * @dev The staking token for this pool
     */
    IERC721 public stakingToken;

    /**
     * @dev The rewards token for this pool
     */
    IERC20 public rewardsToken;

    /**
     * @dev The weight of the pool in the rewards calculation
     */
    uint256 public poolWeight;

    /**
     * @dev The length of a time period
     */
    uint256 public periodLength;

    /**
     * @dev The amount of time required to pass to be able to claim or unstake
     */
    uint256 public timeLockPeriod;

    /**
	 * @dev Track for each stake when it was most recently accessed
	 */
    mapping(address staker => Staker stakerData) public stakers;

    modifier onlySNFTOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner();
        }
        _;
    }

    constructor(
		string memory name,
		string memory symbol,
        IERC721 _stakingToken,
        IERC20 _rewardsToken,
        uint256 _poolWeight,
        uint256 _periodLength,
        uint256 _timeLockPeriod
	) ERC721NonTransferrable(name, symbol) {
        // _createPool(_config);
        stakingToken = _stakingToken;
        rewardsToken = _rewardsToken;
        poolWeight = _poolWeight;
        periodLength = _periodLength;
        timeLockPeriod = _timeLockPeriod;
        // config = _config;
	}

	/**
	 * @notice Stake one or more ERC721 tokens and receive non-transferable ERC721 tokens in return
	 * @param tokenIds Array of tokenIds to be staked by the caller
	 */
    function stake(uint256[] calldata tokenIds) external override {
        Staker storage staker = stakers[msg.sender];

        if (staker.numStaked > 0) {
	        // It isn't their first stake, snapshot pending rewards
            staker.pendingRewards = _getPendingRewards(staker);
        } else {
            // Log the time at which this stake becomes claimable or unstakable
            // This is only done once per user
            staker.unlockTimestamp = block.timestamp + timeLockPeriod;
        }

        uint256 i;
        uint256 len = tokenIds.length;
        for (i ; i < len;) {
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
    function claim() external override {
        Staker storage staker = stakers[msg.sender];
        _claim(staker);
    }

    /**
     * @notice Unstake one or more ERC721 tokens
     * @param tokenIds Array of tokenIds to be unstaked by the caller
     * @param exit Flag for if the user would like to exit without rewards
     */
    function unstake(uint256[] memory tokenIds, bool exit) external override {
        Staker storage staker = stakers[msg.sender];

        if (!exit) {
            _claim(staker);
        }

        uint256 i;
        uint256 len = tokenIds.length;
        for (i; i < len;) {
            uint256 tokenId = tokenIds[i];
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
    function getContractRewardsBalance() external override view returns (uint256) {
        return _getContractRewardsBalance();
    }

    /**
     * @notice View the pending rewards balance for a user
     */
    function getPendingRewards() external override view returns (uint256) {
        return _getPendingRewards(stakers[msg.sender]);
    }

    /**
     * @notice Return the time, in seconds, remaining for a stake to be claimed or unstaked
     */
    function getRemainingLockTime() external override view returns (uint256) {
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
            poolWeight,
            periodLength
        ) + staker.pendingRewards;
    }

    function _stake(
		uint256 tokenId
	) internal {
        // Transfer their NFT to this contract
        IERC721(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Mint user sNFT
        _mint(msg.sender, tokenId);

        emit Staked(tokenId, 1, 0, address(stakingToken));
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

        // Disallow rewards when balance is 0
        if (_getContractRewardsBalance() == 0) {
            revert NoRewards();
        }

        rewardsToken.transfer(
            msg.sender,
            rewards
        );

        emit Claimed(rewards, rewardsToken);
    }

    function _unstake(uint256 tokenId, Staker storage staker) internal onlySNFTOwner(tokenId) {
		_onlyUnlocked(staker.unlockTimestamp);

        _burn(tokenId);

        // Return NFT to staker
        IERC721(stakingToken).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Unstaked(
            tokenId,
            1,
            0,
            address(stakingToken)
        );
    }

    function _getContractRewardsBalance() internal view returns (uint256) {
        return rewardsToken.balanceOf(address(this));
    }

    function _onlyUnlocked(uint256 unlockTimestamp) internal view {
		// User is not staked or has not passed the time lock
        if (unlockTimestamp == 0 || block.timestamp < unlockTimestamp) {
            revert TimeLockNotPassed();
        }
    }
}
