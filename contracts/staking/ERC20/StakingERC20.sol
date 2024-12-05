// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingERC20 } from "./IStakingERC20.sol";
import { StakingBase } from "../StakingBase.sol";
import { AStakingBase } from "../AStakingBase.sol";

import { console } from "hardhat/console.sol";

/**
 * @title StakingERC20
 * @notice A staking contract for ERC20 tokens
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingERC20 is StakingBase, AStakingBase, IStakingERC20 {
    // TODO when ERC20Voter token is ready add here

    using SafeERC20 for IERC20;

    constructor(
        IERC20 _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _lockAdjustment,
        address contractOwner
    )
        StakingBase(
            address(_stakingToken),
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
            _lockAdjustment,
            contractOwner
        )
    {}

    /**
     * @notice Stake an amount of ERC20 with a lock period By locking, 
     * a user cannot access their funds until the lock period is over, but they
     * receive a higher rewards rate for doing so
     * @dev A user can call to `unstake` with `exit` as true to access their funds
     * before the lock period is over, but they will forfeit their rewards
     * @dev This function and the below `stakeWithoutLock` are intentionally separate for clarity
     * 
     * @param amount The amount to stake
     * @param lockDuration The duration of the lock period
     */
    function stakeWithLock(uint256 amount, uint256 lockDuration) external override {
        _stakeNew(amount, lockDuration);
    }

    /**
     * @notice Stake an amount of ERC20 with no lock period. By not locking, a 
     * user can access their funds any time, but they forfeit a higher rewards rate
     * @dev This function and the above`stakeWithLock` are intentionally separate for clarity
     * 
     * @param amount The amount to stake
     */
    function stakeWithoutLock(uint256 amount) external override {
        _stakeNew(amount, 0);
    }

    /**
     * @notice Claim all of the user's rewards that are currently available
     */
    function claim() external {
        // transfer a user their owed rewards + any available pending rewards
        // if funds are locked, only transfer if they are past lock duration
        Staker storage staker = stakers[msg.sender];

        // Get rewards they've accumulated already as well as any pending rewards from their last timestamp
        uint256 rewards = staker.owedRewards + _getPendingRewards(staker, false);

        staker.owedRewards = 0;
        staker.lastTimestamp = block.timestamp;

        if (staker.unlockedTimestamp != 0 && staker.unlockedTimestamp < block.timestamp) {

            // They have locked funds that have past their lock duration, and possibly more
            // If additional time beyond lock duration, add owed rewards at 1.0 rate
            rewards += staker.owedRewardsLocked + _getPendingRewards(staker, true);
            staker.owedRewardsLocked = 0;
            staker.lastTimestampLocked = block.timestamp;
        }

        // Do not transfer 0 rewards
        if (rewards == 0) revert ZeroRewards();

        if (_getContractRewardsBalance() < rewards) revert NoRewardsLeftInContract();

        // Because we update update timestamps before transfer, any reentrancy attempt
        // will use the current timestamps and calculate to 0
        rewardsToken.safeTransfer(msg.sender, rewards);

        emit Claimed(msg.sender, rewards, address(rewardsToken));
    }

    /**
     * @notice Unstake a specified amount of a user's non-locked stake
     * 
     * @param amount The amount to withdraw
     */
    function unstake(uint256 amount) external override {
        _unstake(amount, false, false);
    }

    /**
     * @notice Unstake a specified amount of a user's locked funds that were locked
     * @dev Will revert if funds are still within their lock period and not calling with `exit` as `true`
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
    function getRemainingLockTime() public view override returns (uint256) {
        return _getRemainingLockTime(stakers[msg.sender]);
    }

    function getPendingRewards() public view override returns (uint256) {
        return _getPendingRewards(stakers[msg.sender], false);
    }

    function getPendingRewardsLocked() public view override returns (uint256) {
        return _getPendingRewards(stakers[msg.sender], true);
    }

    function getTotalPendingRewards() public view override returns (uint256) {
        Staker storage staker = stakers[msg.sender];
        return staker.owedRewards + staker.owedRewardsLocked + _getPendingRewards(staker, false) + _getPendingRewards(staker, true);
    }


    // TODO temp, just for debug
    function getStakeValue(uint256 amount, uint256 lockDuration) public view returns (uint256) {
        uint256 rewardsMultiplier = lockDuration == 0 ? 1 : _calcRewardsMultiplier(lockDuration);
        uint256 divisor = lockDuration == 0 ? 1000 : 100000;
        uint256 timeDuration = lockDuration == 0 ? 1 : lockDuration; // make 1 to avoid multiply by 0

        uint256 rewards = rewardsMultiplier * amount * rewardsPerPeriod * timeDuration / periodLength / divisor;

        
        return rewards;
    }

    // TODO temp, just for debug
    function getStakeValueUnlocked(uint256 amount, uint256 timePassed) public view returns (uint256) {
        uint256 rewardsMultiplier = 1;
        uint256 divisor = 1000;

        uint256 rewards = rewardsMultiplier * amount * rewardsPerPeriod * timePassed / periodLength / divisor;

        
        return rewards;
    }

    function _stakeNew(uint256 amount, uint256 lockDuration) internal {
        // TODO be sure when new locks come in after an old lock is expired
        // it is treated like a brand new lock
        if (amount == 0) {
            revert ZeroValue();
        }

        Staker storage staker = stakers[msg.sender];

        if (lockDuration == 0) {
            // Get rewards they are owed from past unlocked stakes, if any
            // `_getPendingRewards` will return 0 if `amountStaked == 0`
            staker.owedRewards += _getPendingRewards(staker, false);
            staker.lastTimestamp = block.timestamp;
            staker.amountStaked += amount;
        } else {
            // Pre calculate the value of the stake
            uint256 stakeValue = _getStakeValue(amount, lockDuration);
            staker.owedRewardsLocked += stakeValue;

            uint256 incomingUnlockedTimestamp = block.timestamp + lockDuration;
            // if incoming is smaller, be sure we are not past, if so it is a new lock
            // otherwise update like below
            // TODO if passed lock and never claimed or unstaked, what to do?
                // claim rewards for time between as 1.0, then everything forward
                // is new stake lock duration
            // if passed lock and zero balance, should be fine?
            if (incomingUnlockedTimestamp > staker.unlockedTimestamp) {
                // When followup stakes with lock, the lock period is extended by a specified amount
                // this value cannot be less than the existing lock time
                staker.unlockedTimestamp = incomingUnlockedTimestamp;
            }

            staker.lastTimestampLocked = block.timestamp;
            staker.amountStakedLocked += amount;    
        }

        // Transfers user's funds to this contract
        SafeERC20.safeTransferFrom(IERC20(stakingToken), msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, lockDuration, stakingToken);
    }

    // function _stake(uint256 amount, uint256 lockDuration) internal {
    //     if (amount == 0) {
    //         revert ZeroValue();
    //     }

    //     Staker storage staker = stakers[msg.sender];

    //     if (lockDuration == 0) {
    //         // incoming stake isnt locking
    //         staker.owedRewards += _getPendingRewards(staker, false);
    //         staker.lastTimestamp = block.timestamp;
    //         staker.amountStaked += amount;
    //     } else {

    //         /**
    //          * TODO impl
    //          * 
    //          * each incoming stake can have it's entire value and RM pre calculated and stored under "owedRewards"
    //          * 
    //          */

    //         uint256 rewardsMultiplier = _calcRewardsMultiplier(lockDuration);
    //         uint256 unlockTimestamp = block.timestamp + lockDuration;
    //         uint256 lastTimestamp = staker.lastTimestampLocked == 0 ? block.timestamp : staker.lastTimestampLocked;

    //         uint256 rewards = rewardsMultiplier * (amount * (rewardsPerPeriod * (lockDuration)) / periodLength / 100000);

    //         staker.owedRewardsLocked += rewards;

    //         // incoming stake is locking
    //         if (staker.unlockedTimestamp == 0) {
    //             // first time locking stake
    //             staker.lockDuration = lockDuration;
    //             staker.unlockedTimestamp = block.timestamp + lockDuration;
    //             staker.rewardsMultiplier = _calcRewardsMultiplier(lockDuration);
    //         } else {
    //             // When restaking with lock, the lock period is extended by a specified amount
    //             _adjustLock(staker);
    //         }

    //         // Must always update this before we update `lastTimestampLocked`
    //         staker.owedRewardsLocked += _getPendingRewards(staker, true);
    //         staker.lastTimestampLocked = block.timestamp;
    //         staker.amountStakedLocked += amount;
    //     }

    //     // Transfers user's funds to this contract
    //     SafeERC20.safeTransferFrom(IERC20(stakingToken), msg.sender, address(this), amount);

    //     emit Staked(msg.sender, amount, lockDuration, stakingToken);
    // }

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
                    rewards = 0;
                } else {
                    revert TimeLockNotPassed();
                }
            } else {
                // If staker's funds are unlocked, we ignore exit
                rewards = staker.owedRewardsLocked + _getPendingRewards(staker, true);
            }

            // If removal of all locked funds and there are no non-locked funds, delete
            if (staker.amountStakedLocked - amount == 0) {
                if (staker.amountStaked == 0) {
                    delete stakers[msg.sender];
                } else {
                    // Otherwise set locked values to 0
                    staker.owedRewardsLocked = 0;
                    staker.amountStakedLocked = 0;
                    staker.lastTimestampLocked = 0;
                    staker.unlockedTimestamp = 0;
                }
            } else {
                // If not withdrawal, update locked values
                staker.owedRewardsLocked = 0;
                staker.amountStakedLocked -= amount;
                staker.lastTimestampLocked = block.timestamp;
            }
        } else {
            if (amount > staker.amountStaked) {
                revert UnstakeMoreThanStake();
            }

            rewards = staker.owedRewards + _getPendingRewards(staker, false);

            if (staker.amountStaked - amount == 0) {
                if (staker.amountStakedLocked == 0) {
                    // If unstake completely removes all staker funds, delete from mapping
                    delete stakers[msg.sender];
                }  else {
                    // Otherwise update non-locked values
                    staker.owedRewards = 0;
                    staker.amountStaked = 0;
                    staker.lastTimestamp = 0;
                }
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
