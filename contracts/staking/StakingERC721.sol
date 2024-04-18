// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721NonTransferrable } from "../tokens/ERC721NonTransferrable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AStakingBase } from "./AStakingBase.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";


/**
 * @title Staking721
 * @notice A staking contract that allows depositing ERC721 tokens and mints a
 * non-transferable ERC721 token in return as representation of the deposit.
 */
contract StakingERC721 is ERC721NonTransferrable, AStakingBase, IStakingERC721 {
    /**
     * @dev Mapping of each staker to that staker's data in the `Staker` struct
     */
    mapping(address staker => Staker stakerData) public stakers;

    /**
     * @dev Revert if a call is not from the SNFT owner
     */
    modifier onlySNFTOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner();
        }
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _timeLockPeriod
    )
        ERC721NonTransferrable(name, symbol)
        AStakingBase(
            _stakingToken,
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
            _timeLockPeriod
        )
    {}

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
        for (i; i < tokenIds.length;) {
            _stake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }

        staker.numStaked += tokenIds.length;
        staker.lastUpdatedTimestamp = block.timestamp;
    }

    /**
     * @notice Claim rewards for all staked ERC721 tokens
     * @dev Will revert if the time lock period has not been met or if
     * the user has not staked any tokens
     */
    function claim() external override {
        _claim(stakers[msg.sender]);
    }

    /**
     * @notice Unstake one or more ERC721 tokens
     * @param tokenIds Array of tokenIds to be unstaked by the caller
     * @param exit Flag for if the user would like to exit without rewards
     */
    function unstake(uint256[] memory tokenIds, bool exit) external override {
        Staker storage staker = stakers[msg.sender];

        _onlyUnlocked(staker.unlockTimestamp);

        uint256 i;
        for (i; i < tokenIds.length;) {
            _unstake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }

        if (!exit) {
            _claim(staker);
        }

        // if `numStaked < tokenIds.length` it will have already failed above
        // don't need to check here
        staker.numStaked -= tokenIds.length;

        if (staker.numStaked == 0) {
            delete stakers[msg.sender];
        } else {
            staker.lastUpdatedTimestamp = block.timestamp;
        }
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance()
        external
        view
        override
        returns (uint256)
    {
        return _getContractRewardsBalance();
    }

    /**
     * @notice View the pending rewards balance for a user
     */
    function getPendingRewards() external view override returns (uint256) {
        return _getPendingRewards(stakers[msg.sender]);
    }

    /**
     * @notice Return the time, in seconds, remaining for a stake to be claimed or unstaked
     */
    function getRemainingLockTime() external view override returns (uint256) {
        // Return the time remaining for the stake to be claimed or unstaked
        Staker memory staker = stakers[msg.sender];
        if (block.timestamp > staker.unlockTimestamp) {
            return 0;
        }

        return staker.unlockTimestamp - block.timestamp;
    }

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    function _getPendingRewards(
        Staker storage staker
    ) internal view returns (uint256) {
        // Return any existing pending rewards value plus the
        // calculated rewards based on the last updated timestamp
        return
            staker.pendingRewards +
            _calculateRewards(
                block.timestamp - staker.lastUpdatedTimestamp,
                staker.numStaked
            );
    }

    function _stake(uint256 tokenId) internal {
        // Transfer their NFT to this contract
        IERC721(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Mint user sNFT
        _mint(msg.sender, tokenId);

        emit Staked(tokenId, stakingToken);
    }

    function _claim(Staker storage staker) internal {
        // Require the time lock to have passed
        _onlyUnlocked(staker.unlockTimestamp);

        // Returns the calculated rewards since the last time stamp + pending rewards
        uint256 rewards = _getPendingRewards(staker);

        staker.lastUpdatedTimestamp = block.timestamp;
        staker.pendingRewards = 0;

        // Disallow rewards when balance is 0
        if (_getContractRewardsBalance() == 0) {
            revert NoRewardsLeftInContract();
        }

        rewardsToken.transfer(msg.sender, rewards);

        emit Claimed(rewards, address(rewardsToken));
    }

    function _unstake(uint256 tokenId) internal onlySNFTOwner(tokenId) {
        _burn(tokenId);

        // Return NFT to staker
        IERC721(stakingToken).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Unstaked(tokenId, stakingToken);
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
