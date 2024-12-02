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

    /**
     * @notice The length of each rewards period
     */
    uint256 public immutable periodLength;

    /**
     * @notice The amount of time to add to a user's lock period after any follow up stakes
     */
    uint256 public lockAdjustment; // TODO leaving for now but may not need

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _lockAdjustment,
        address _contractOwner
    ) Ownable(_contractOwner) {
        if (
            _stakingToken.code.length == 0 ||
            address(_rewardsToken).code.length == 0 ||
            _rewardsPerPeriod == 0 ||
            _periodLength == 0
        ) revert InitializedWithZero();

        stakingToken = _stakingToken;
        rewardsToken = _rewardsToken;
        rewardsPerPeriod = _rewardsPerPeriod;
        periodLength = _periodLength;
        lockAdjustment = _lockAdjustment;
    }

    function _adjustLock(Staker storage staker) internal {
        /** TODO
         * A) Add half of the remaining lock time
         * B) Add half of the original lock duration
         * C) Add the lock adjustment value
         */
        // staker.unlockedTimestamp += remainingLock / 2;
        // staker.unlockedTimestamp += lockAdjustment;
        staker.unlockedTimestamp += staker.lockDuration / 2;
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
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance() external view override returns (uint256) {
        return _getContractRewardsBalance();
    }

    // TODO do we want to use lock adjustment? probably not, but keep as option for discussion
    function setLockAdjustment(uint256 _lockAdjustment) public override onlyOwner {
        lockAdjustment = _lockAdjustment;
        emit LockAdjustmentSet(msg.sender, _lockAdjustment);
    }

    // function setMultiplier(uint256 _multiplier) public onlyOwner {
    //     MULTIPLIER = _multiplier;
    //     emit MultiplierSet(msg.sender, _multiplier);
    // }

    // function getMultiplier() public view override returns (uint256) {
    //     return MULTIPLIER;
    // }

    // Staker getters
    // TODO Some are shared but many are token specific, consider
    // moving these to the contracts that need them instead to avoid bloat
    // for useless ERC20 functions in ERC721 contract or vice versa

    // ERC721s OR unlocked ERC20 amount
    // function getAmountStaked() public view override returns(uint256) {
    //     return stakers[msg.sender].amountStaked;
    // }

    // // Locked ERC20 amount or locked ERC721s
    // function getAmountStakedLocked() public view override returns(uint256) {
    //     return stakers[msg.sender].amountStakedLocked;
    // }

    

    // // function getLockDuration(uint256 tokenId) public view override returns (uint256) {
    // //     // Lock duration for a specific ERC721 tokenId
    // //     return stakers[msg.sender].lockDurations[tokenId];
    // // }

    // function getLockDuration() public view override returns (uint256) {
    //     // Lock duration for a user's ERC20 stake
    //     return stakers[msg.sender].lockDuration;
    // }

    // function getStakedTimestamp(uint256 tokenId) public view override returns (uint256) {
    //     return stakers[msg.sender].stakedTimestamps[tokenId];
    // }

    // function getLastTimestamp() public view override returns (uint256) {
    //     return stakers[msg.sender].lastTimestamp;
    // }

    // function getLastTimestampLocked() public view override returns (uint256) {
    //     return stakers[msg.sender].lastTimestampLocked;
    // }

    // function getlastClaimedTimestamp(uint256 tokenId) public view override returns (uint256) {
    //     // In ERC721 still last*Claimed*, not just lastTimestamp
    //     return stakers[msg.sender].lastClaimedTimestamps[tokenId];
    // }

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    function _getRemainingLockTime(Staker storage staker) internal view returns(uint256) {
        if (staker.amountStakedLocked == 0 || staker.unlockedTimestamp < block.timestamp) return 0;

        return staker.unlockedTimestamp - block.timestamp;
    }

    function _getPendingRewards(Staker storage staker, bool locked) internal view returns (uint256) {
        if (staker.amountStaked == 0 || staker.amountStakedLocked == 0) {
            return 0;
        }

        if (locked) {
            // div 100,000 at end to moderate (2 extra decimals of precision because multiplier is scaled in size for decimals)
            console.log("staker.rewardsMultiplier: %s", staker.rewardsMultiplier);
            console.log("staker.amountStakedLocked: %s", staker.amountStakedLocked);
            console.log("rewardsPerPeriod: %s", rewardsPerPeriod);
            console.log("block.timestamp: %s", block.timestamp);
            console.log("staker.lastTimestampLocked: %s", staker.lastTimestampLocked);
            console.log("diff: %s", block.timestamp - staker.lastTimestampLocked);

            // 100 000
            // 1 000

            uint256 retval = staker.rewardsMultiplier * (
                staker.amountStakedLocked * (rewardsPerPeriod * (block.timestamp - staker.lastTimestampLocked)) / periodLength / 100000 );
            // console.log("retval: %s", retval);
            return retval;
        } else {
            console.log("not locked flow");

            // div 1000 at end to moderate
            return staker.amountStaked * (rewardsPerPeriod * (block.timestamp - staker.lastTimestamp)) / periodLength / 1000;
        }
    }

    // TODO TEMP for testing
    function getRewardsMultiplier(uint256 lock) public pure returns(uint256) {
        return _calcRewardsMultiplier(lock);
    }

    /**
     * @dev Locked rewards receive a multiplier based on the length of the lock
     * @param lock The length of the lock in seconds
     */
    function _calcRewardsMultiplier(uint256 lock) internal pure returns(uint256) {
        // maxRM = 10
        // periodLength = 365 days
        // precisionMultiplier = 10
        // scalar = 1e18
        return 1e14 * 10 * ( (lock * 10 ) / 365) / 1e18;
    }

    // Backup function using simpler multipliers to avoid uintended side effects
    // from the math above, like having to have minimum lock durations
    function _calcRewardsMultiplierSimple(uint256 lock) internal pure returns(uint256 multiplier) {
        if (lock < 30 days) return 110;
        if (lock < 60 days) return 120;
        if (lock < 90 days) return 130;
        if (lock < 120 days) return 140;
        if (lock < 150 days) return 150;
        if (lock < 180 days) return 190;
        if (lock < 210 days) return 240;
        if (lock < 240 days) return 300;
        if (lock < 270 days) return 370;
        if (lock < 300 days) return 450;
        if (lock < 330 days) return 540;
        if (lock < 365 days) return 640;
        if (lock > 365 days) return 800;
        
        // 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610
        if (lock > 365) return 1000;
    }

    function _getContractRewardsBalance() internal view returns (uint256) {
        return rewardsToken.balanceOf(address(this));
    }
}
