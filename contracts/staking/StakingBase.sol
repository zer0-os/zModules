// SPDX-License-Identifier: MIT
// solhint-disable immutable-vars-naming
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingBase } from "./IStakingBase.sol";

import { console } from "hardhat/console.sol";

/**
 * @title StakingBase
 * @notice A set of common elements that are used in any Staking contract
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingBase is Ownable, IStakingBase {
    using SafeERC20 for IERC20;

    /**
     * @notice The multiplier multiplier used in rewards calculations
     */
    uint256 MULTIPLIER = 1e16;

    /**
     * @notice Mapping of each staker to that staker's data in the `Staker` struct
     */
    mapping(address user => Staker staker) public stakers;

    /**
     * @notice The staking token for this pool
     */
    address public immutable stakingToken;

    /**
     * @notice The rewards token for this pool
     */
    IERC20 public immutable rewardsToken;

    /**
     * @notice The rewards of the pool per period length
     */
    uint256 public immutable rewardsPerPeriod;

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        // uint256 _periodLength, // TODO also have max # periods? e.g. 365 days
        address _contractOwner
    ) Ownable(_contractOwner) {
        if (
            _stakingToken.code.length == 0 ||
            address(_rewardsToken).code.length == 0 ||
            _rewardsPerPeriod == 0
            // _periodLength == 0
        ) revert InitializedWithZero();

        stakingToken = _stakingToken;
        rewardsToken = _rewardsToken;
        rewardsPerPeriod = _rewardsPerPeriod;
    }

    /**
     * @notice Emergency function for the contract owner to withdraw leftover rewards
     * in case of an abandoned contract.
     * @dev Can only be called by the contract owner. Emits a `RewardFundingWithdrawal` event.
     */
    function withdrawLeftoverRewards() external override onlyOwner {
        uint256 balance = rewardsToken.balanceOf(address(this));
        if (balance == 0) revert NoRewardsLeftInContract();

        rewardsToken.safeTransfer(owner(), balance);

        emit LeftoverRewardsWithdrawn(owner(), balance);
    }

    /**
     * @notice View the pending rewards balance for a user
     */
    function getPendingRewards() external view override returns (uint256) {
        return _getPendingRewards(stakers[msg.sender], false);
    }

    /**
     * @notice View the pending locked rewards balance for a user
     */
    function getPendingRewardsLocked() external view returns (uint256) {
        return _getPendingRewards(stakers[msg.sender], true);
    }

    // TODO reimplement fixed version for ERC721

    /**
     * @notice View the total pending rewards balance for a user
     */
    function getAllPendingRewards() external view override returns (uint256) {
        return _getPendingRewards(stakers[msg.sender], false) + _getPendingRewards(stakers[msg.sender], true);
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance() external view override returns (uint256) {
        return _getContractRewardsBalance();
    }

    function setMultiplier(uint256 _multiplier) public onlyOwner {
        MULTIPLIER = _multiplier;
        emit MultiplierSet(msg.sender, _multiplier);
    }

    function getMultiplier() public view override returns (uint256) {
        return MULTIPLIER;
    }

    // Staker getters
    // TODO Some are shared but many are token specific, consider
    // moving these to the contracts that need them instead to avoid bloat
    // for useless ERC20 functions in ERC721 contract or vice versa

    function getAmountStaked() public view override returns(uint256) {
        // ERC721s OR unlocked ERC20 amount
        return stakers[msg.sender].amountStaked;
    }

    function getAmountStakedLocked() public view override returns(uint256) {
        // Locked ERC20 amount or locked ERC721s
        return stakers[msg.sender].amountStakedLocked;
    }

    function getStakedTokenIds() public view override returns(uint256[] memory) {
        // Staked ERC721 tokenIds
        return stakers[msg.sender].tokenIds;
    }

    function getLockDuration(uint256 tokenId) public view override returns (uint256) {
        // Lock duration for a specific ERC721 tokenId
        return stakers[msg.sender].lockDurations[tokenId];
    }

    function getLockDuration() public view override returns (uint256) {
        // Lock duration for a user's ERC20 stake
        return stakers[msg.sender].lockDuration;
    }

    function getStakedTimestamp(uint256 tokenId) public view override returns (uint256) {
        return stakers[msg.sender].stakedTimestamps[tokenId];
    }

    function getLastTimestamp() public view override returns (uint256) {
        return stakers[msg.sender].lastTimestamp;
    }

    function getLastTimestampLocked() public view override returns (uint256) {
        return stakers[msg.sender].lastTimestampLocked;
    }

    function getlastClaimedTimestamp(uint256 tokenId) public view override returns (uint256) {
        // In ERC721 still last*Claimed*, not just lastTimestamp
        return stakers[msg.sender].lastClaimedTimestamps[tokenId];
    }

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    // TODO make for both ERC721 and ERC20? or empty with virtual?
    function _getPendingRewards(Staker storage staker, bool locked) internal view returns (uint256) {

        // user has no stake, return 0
        if (staker.amountStaked == 0 && staker.amountStakedLocked == 0) {
            return 0;
        }

        if (locked) {
            // div 100,000 at end to moderate (2 extra decimals of precision because multiplier is scaled in size for decimals)
            return staker.rewardsMultiplier * (
                staker.amountStakedLocked * (rewardsPerPeriod * (block.timestamp - staker.lastTimestampLocked)) / 86400 / 100000
            );
        } else {
            // div 1000 at end to moderate
            return staker.amountStaked * (rewardsPerPeriod * (block.timestamp - staker.lastTimestamp)) / 86400 / 1000;
        }
    }

    function _calcRewardsMultiplier(uint256 lock) internal pure returns(uint256) {
        // maxRM = 10
        // periodLength = 365 days
        // precisionMultiplier = 10
        // scalar = 1e18
        return 1e14 * 10 * ( (lock * 10 ) / 365) / 1e18;
    }

    function _getContractRewardsBalance() internal view returns (uint256) {
        return rewardsToken.balanceOf(address(this));
    }

    function _checkUnlocked(Staker storage staker, uint256 tokenId) internal view returns (bool) {
        return staker.stakedTimestamps[tokenId] + staker.lockDurations[tokenId] < block.timestamp;
    }
}
