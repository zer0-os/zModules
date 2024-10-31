// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingERC20 } from "./IStakingERC20.sol";
import { StakingBase } from "../StakingBase.sol";

import { console } from "hardhat/console.sol";

/**
 * @title StakingERC20
 * @notice A staking contract for ERC20 tokens
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingERC20 is StakingBase, IStakingERC20 {
    // TODO when ERC20Voter token is ready add here to give stakers the 
    // ability to vote in a DAO

    using SafeERC20 for IERC20;

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        address contractOwner
    )
        StakingBase(
            _stakingToken,
            _rewardsToken,
            _rewardsPerPeriod,
            contractOwner
        )
    {}

    /**
     * @notice Stake an amount of ERC20 with a lock period By locking, 
     * a user cannot access their funds until the lock period is over, but they
     * receive a higher rewards rate for doing so
     * @dev This function and the below `stakeWithoutLock` are intentionally separate for clarity
     * 
     * @param amount The amount to stake
     * @param lockDuration The duration of the lock period
     */
    function stakeWithLock(uint256 amount, uint256 lockDuration) external {
        _stake(amount, lockDuration);
    }

    /**
     * @notice Stake an amount of ERC20 with no lock period. By not locking, a 
     * user can access their funds any time, but they forfeit a higher rewards rate
     * @dev This function and the below `stakeWithoutLock` are intentionally separate for clarity
     * 
     * @param amount The amount to stake
     */
    function stakeWithoutLock(uint256 amount) external override {
        _stake(amount, 0);
    }

    /**
     * @notice Unstake some or all of a user's non-locked stake
     * 
     * @param amount The amount to withdraw
     */
    function unstake(uint256 amount) external override {
        _unstake(amount, false, false);
    }

    /**
     * @notice Unstake funds that were locked
     * @dev Will revert if funds are still within their lock period and not exitting
     * 
     * @param amount The amount to withdraw 
     * @param exit Boolean if user wants to forfeit rewards
     */
    function unstakeLocked(uint256 amount, bool exit) public override {
        _unstake(amount, true, exit);
    }

    /**
     * @notice Return the time in seconds remaining for the staker's lock duration
     */
    function getRemainingLockTime() public view override returns(uint256) {
        Staker storage staker = stakers[msg.sender];

        if (staker.amountStakedLocked == 0 || staker.unlockedTimestamp < block.timestamp) return 0;

        return staker.unlockedTimestamp - block.timestamp;
    }

    // TODO consider adding an ability to unlock a stake so users can access their funds if they want to,
    // but they forfeit the rewards they would have earned if they had kept it locked, so it gets rewards
    // as though it was never locked in the first place
    function _unlock() internal {
        // unlock a stake for a user, removing their extra rewards
        // but allowing them to access their funds immediately
        // move staked amoun to regular amount after snapshot of balance
    }

    // TODO both additional claims AND additional stakes can reduce long term ROI
    // as exponential from last touch point. Consider changing the rewards math to be simpler
    // e.g. establish multiplier upon initial stake and always just use that multiplier
    // This could be gamed because you if your multiplier is only based on the length of stake

    // you could stake 1 for 1 year to get a big multiplier, then add 10000 at the end and claim it rapidly to
    // get that large multiplier on 10001 total, UNLESS we snapshot rewards properly on new stakes
    // you get (RM * stakeBalance * lengthOfStake) assigned to you when you make a new stake, then going forward
    // rewards are calculated only at your new balance based on your last touchpoint


    // Adjust the remaining lock time based on a new incoming stake value
    function _updateRemainingLockTime(uint256 incomingAmount) internal view returns(uint256) {
        Staker storage staker = stakers[msg.sender];

        // Formula for adjusting a users lock timestamp based on a new incoming stake value
        // and the percentage of time they have passed in the defined stake lock
        // lockDuration * ( (amountStaked * %lockRemaining) + (incomingAmount) ) / (amountStaked + incomingAmount)
        // Effectively equivalent to a weighted sum of the remaining time and the new incoming stake weighted at 100%
        // f(x) = aW_1 + bW_2 * k

        console.log("staker.lockDuration : ", staker.lockDuration);
        console.log("staker.amountStakedLocked : ", staker.amountStakedLocked);
        console.log("block.timestamp : ", block.timestamp);
        console.log("staker.lastTimestampLocked : ", staker.lastTimestampLocked);
        console.log("incomingAmount : ", incomingAmount);

        uint256 newRemainingLock = 
            staker.lockDuration * ( 
                (
                    staker.amountStakedLocked * 
                    (1000 * 
                        (
                            staker.lockDuration - (block.timestamp - staker.lastTimestampLocked)
                        ) / staker.lockDuration
                    ) / 1000
                )
                +
                (incomingAmount)) / (staker.amountStakedLocked + incomingAmount);

        return newRemainingLock;
    }

    function _stake(uint256 amount, uint256 lockDuration) internal {
        if (amount == 0) {
            revert ZeroValue();
        }

        Staker storage staker = stakers[msg.sender];

        if (lockDuration == 0) {
            // console.log("1");
            // incoming stake isnt locking
            // add to not locked pool after updating the rewards they are owed
            staker.owedRewards += _getPendingRewards(staker, false); // Will be 0 on first stake
            staker.lastTimestamp = block.timestamp;
            // console.log("valafter : ", staker.owedRewards);

            staker.amountStaked += amount;
        } else {
            // console.log("2");

            // incoming stake is locking
            if (staker.unlockedTimestamp == 0) {
                // console.log("3");

                // first time locking stake
                staker.lockDuration = lockDuration;
                staker.unlockedTimestamp = block.timestamp + lockDuration;
                staker.rewardsMultiplier = _calcRewardsMultiplier(lockDuration);
            } else {
                // console.log("4");
                // TODO resolve with neo what to do, for now just simple shift to start
                staker.unlockedTimestamp = block.timestamp + staker.lockDuration;
            }

            // Must always update this before we update `lastTimestampLocked`
            staker.owedRewardsLocked += _getPendingRewards(staker, true);
            staker.lastTimestampLocked = block.timestamp;
            staker.amountStakedLocked += amount;
        }

        // Transfers users funds to this contract
        // TODO a vault instead? would be more expensive
        // User must have approved this contract to transfer their funds
        SafeERC20.safeTransferFrom(IERC20(stakingToken), msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, stakingToken);
    }

    function _unstake(uint256 amount, bool locked, bool exit) internal {
        if (amount == 0) {
            revert ZeroValue();
        }

        Staker storage staker = stakers[msg.sender];

        uint256 rewards;

        if (locked) {
            if (amount > staker.amountStakedLocked) {
                revert UnstakeMoreThanStake();
            }

            if (staker.unlockedTimestamp > block.timestamp) {
                // Only allow use of exit on funds that are still locked
                if (exit) {                    
                    // Because the `_getPendingRewards` function call uses a stakers non-locked values,
                    // we need to temporarily modify those to be the staked values when calculating
                    // then reset to what they were before
                    uint256 temp = staker.amountStaked;
                    staker.amountStaked = staker.amountStakedLocked;

                    uint256 tempTimestamp = staker.lastTimestamp;
                    staker.lastTimestamp = staker.lastTimestampLocked;

                    rewards = staker.owedRewards + _getPendingRewards(staker, false);

                    // Reset their amount staked to the correct value
                    staker.amountStaked = temp;
                    staker.lastTimestamp = tempTimestamp;

                    // TODO OR do we set rewards 0 for exit?
                } else {
                    revert TimeLockNotPassed();
                }
            } else {
                // If staker's funds are unlocked, we ignore exit
                rewards = staker.owedRewardsLocked + _getPendingRewards(staker, true);
            }

            // If removal of all locked funds and there are no non-locked funds, delete
            if (staker.amountStakedLocked - amount == 0 && staker.amountStaked == 0) {
                delete stakers[msg.sender];
            } else {
                // Otherwise update locked values
                staker.owedRewardsLocked = 0;
                staker.amountStakedLocked -= amount;
                staker.lastTimestampLocked = block.timestamp;
            }
        } else {
            if (amount > staker.amountStaked) {
                revert UnstakeMoreThanStake();
            }
            rewards = staker.owedRewards + _getPendingRewards(staker, false);

            // If removal of all non-locked funds and there are no locked funds, delete
            if (staker.amountStaked - amount == 0 && staker.amountStakedLocked == 0) {
                delete stakers[msg.sender];
            } else {
                // Otherwise update non-locked values
                staker.owedRewards = 0;
                staker.amountStaked -= amount;
                staker.lastTimestamp = block.timestamp;
            }
        }

        if (rewards > 0) {
            // Revert if we are unable to pay user their rewards
            if (_getContractRewardsBalance() < rewards) revert NoRewardsLeftInContract();

            // Transfer the user's rewards
            rewardsToken.safeTransfer(msg.sender, rewards);
        }

        // Return the user's initial stake
        IERC20(stakingToken).safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, stakingToken);
    }
}
