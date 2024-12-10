// SPDX-License-Identifier: MIT
// solhint-disable immutable-vars-naming
pragma solidity ^0.8.26;

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
        // TODO how to % without gameable / exploit
        // dont want to punish people for adding more money
        // be sure tie rewards to length of time

        // todo adjust reward multiplier AND lock time together when they restake
        // ratio has to be balanced with multiplier, higher RM is longer time
        // add the length of time they specify perhaps

        // add locks together, add RM together, calc average
        // 

        // staker.unlockedTimestamp += remainingLock / 2;
        // staker.unlockedTimestamp += lockAdjustment;
        staker.unlockedTimestamp += staker.lockDuration / 2;

        // if stake a second time, and first lock is over, claim for first lock then restake and start new deposit
        // give brand new RM and lock time from what their adding

        // if lock has passed but they claim later than that it goes to regular non-locked rate for that extra time

        /**
         * T1 : 1000 for 15 periods, get RM 1.5
         *  
         * T10 : 500 more for 30 periods, get RM for this first, say 3.0, can precalc rewards we know they will get
         * 
         * (1000 * 5periods * 1.5) + (500 * 30periods * 3.0)
         * 
         * 
         * can only append to previous stake? maybe?
         */
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

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    function _getRemainingLockTime(Staker storage staker) internal view returns(uint256) {
        if (staker.amountStakedLocked == 0 || staker.unlockedTimestamp < block.timestamp) return 0;

        return staker.unlockedTimestamp - block.timestamp;
    }

    // todo temp
    function getUnlockedStakeValue(uint256 amount, uint256 timePassed) public view returns(uint256) {
        return amount * rewardsPerPeriod * timePassed / periodLength / 1000;
    }

    // todo temp
    function getLockedStakeValue(uint256 amount, uint256 lockDuration) public view returns(uint256) {
        return _getStakeValue(amount, lockDuration);
    }

    function _getStakeValue(uint256 amount, uint256 lockDuration) internal view returns(uint256) {
        // bug if using to calc non-locked stake value after time has passed
        uint256 rewardsMultiplier = lockDuration == 0 ? 1 : _calcRewardsMultiplier(lockDuration);
        uint256 divisor = lockDuration == 0 ? 1000 : 100000;
        uint256 timeDuration = lockDuration == 0 ? 1 : lockDuration; // make 1 to avoid multiply by 0

        // console.log("rewardsMultiplier: %s", rewardsMultiplier);
        // console.log("amount: %s", amount);
        // console.log("rewardsPerPeriod: %s", rewardsPerPeriod);
        // console.log("lockDuration: %s", lockDuration);
        // console.log("timeDuration: %s", timeDuration);
        // console.log("periodLength: %s", periodLength);
        // console.log("divisor: %s", divisor);
        uint256 rewards = rewardsMultiplier * amount * rewardsPerPeriod * timeDuration / periodLength / divisor;

        // console.log("rewards: %s", rewards);
        return rewards;
    }

    // Return the sum of ALL the rewards available to a user at this moment
    function _getPendingRewards(Staker storage staker) internal view returns (uint256) {

        // Get rewards from non-locked funds already accrued and also between the last timestamp and now
        uint256 rewards = staker.owedRewards + _getInterimRewards(staker, block.timestamp - staker.lastTimestamp, false);
        
        // Only include rewards from locked funds the user is passed their lock period
        if (_getRemainingLockTime(staker) == 0) {
            // We add the precalculated value of locked rewards to the `staker.owedRewardsLocked` sum on stake,
            // so we don't need to add it here as it would be double counted

            // Case A) user stakes with lock, then waits well beyond lock duration and claims
            // need to make sure that everything past `unlockTimestamp` is calculated at the non-locked rate
            // Case B) user stakes with lock and waits well beyond lock period, claims, then waits and claims again in the future
            // Have to make sure that we read from the time between their last touch point at non-locked rate
            // meaning we have to check which timestamp is more recent
            uint256 mostRecentTimestamp = staker.lastTimestampLocked > staker.unlockedTimestamp
                ? staker.lastTimestampLocked
                : staker.unlockedTimestamp;

            rewards += staker.owedRewardsLocked + _getInterimRewards(staker, block.timestamp - mostRecentTimestamp, true);
        }

        return rewards;
    }

    // Get rewards a user accrued between their last touch point and now
    // In the `locked` case, we only calculate rewards if the user has surpassed their lock period
    function _getInterimRewards(Staker storage staker, uint256 timePassed, bool locked) internal view returns (uint256) {
        if (locked) {
            // uint256 retvalB = staker.amountStaked * (rewardsPerPeriod * (timePassed)) / periodLength / 1000;
            // console.log("retvalB: %s", retvalB);

            return staker.amountStakedLocked * (rewardsPerPeriod * (timePassed)) / periodLength / 1000;
        } else {

            return staker.amountStaked * (rewardsPerPeriod * (timePassed)) / periodLength / 1000;
        }
    }

    // TODO TEMP for testing
    function getRewardsMultiplier(uint256 lock) public pure returns(uint256) {
        return _calcRewardsMultiplier(lock);
    }

    // TODO testing debug
    function getRewardsMultiplierSimple(uint256 lock) public pure returns(uint256) {
        return _calcRewardsMultiplierSimple(lock);
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

        // 101 is smallest possible increment while giving more than
        // if a user simply didnt lock their funds, but not by a lot
        // TODO could argue that have a minimum lock time is a good idea?
        // could help make sure people cant exploit the system
        // you cant lock for 1s just to get RM and boost rewards

        // use 1 + to avoid ever having 0 return value
        // if we want 30 day min lock time 259 is a good divisor
        // for both ERC20 and ERC721 staking contracts 

        return 1 + 1e14 * 10 * ( (lock * 10 ) / 259) / 1e18;
        // return 101 + 1e14 * 10 * ( (lock * 10 ) / 365) / 1e18;
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
        if (lock == 365 days) return 800;
        if (lock > 365 days) return 1000;
    }

    function _getContractRewardsBalance() internal view returns (uint256) {
        return rewardsToken.balanceOf(address(this));
    }
}
