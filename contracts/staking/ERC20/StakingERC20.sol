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
    // TODO when ERC20Voter token is ready add here

    using SafeERC20 for IERC20;

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        address contractOwner
    )
        StakingBase(
            _stakingToken,
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
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
        _stake(amount, lockDuration);
    }

    /**
     * @notice Stake an amount of ERC20 with no lock period. By not locking, a 
     * user can access their funds any time, but they forfeit a higher rewards rate
     * @dev This function and the above`stakeWithLock` are intentionally separate for clarity
     * 
     * @param amount The amount to stake
     */
    function stakeWithoutLock(uint256 amount) external override {
        _stake(amount, 0);
    }

    /**
     * @notice Claim all of the user's rewards that are currently available
     */
    function claim() external {
        // transfer a user their owed rewards + any available pending rewards
        // if funds are locked, only transfer if they are past lock duration
        Staker storage staker = stakers[msg.sender];

        uint256 rewards = staker.owedRewards + _getPendingRewards(staker, false);

        staker.owedRewards = 0;
        staker.lastTimestamp = block.timestamp;

        if (staker.unlockedTimestamp != 0 && staker.unlockedTimestamp < block.timestamp) {

            // They can only receive rewards from locked funds when they are past lock period
            rewards += staker.owedRewardsLocked + _getPendingRewards(staker, true);
            staker.owedRewardsLocked = 0;
            staker.lastTimestampLocked = block.timestamp;
        }

        // Do not transfer 0 rewards
        if (rewards == 0) revert ZeroRewards();
        // console.log("rewards", rewards);

        if (_getContractRewardsBalance() < rewards) revert NoRewardsLeftInContract();

        // Because we update update timestamps before transfer, any reentrancy attempt
        // will use the current timestamps and calculate to 0
        rewardsToken.safeTransfer(msg.sender, rewards);

        emit Claimed(msg.sender, rewards, address(rewardsToken));
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

    // TODO do we want this feature?
    function _unlock() internal {
        // unlock a stake for a user, removing their extra rewards
        // and treat it like it was always non-locked stake
        // allowing them to access their funds immediately
        // move staked amoun to regular amount after snapshot of balance
    }

    // Adjust the remaining lock time based on a new incoming stake value
    function _updateRemainingLockTime(uint256 incomingAmount) internal view returns(uint256) {
        Staker storage staker = stakers[msg.sender];

        // TODO this formula breaks if stakes are too close in time.
        // Keeping for posterity, but will need to be resolved.
        // For now do simple shift forward

        // Formula for adjusting a users lock timestamp based on a new incoming stake value
        // and the percentage of time they have passed in the defined stake lock
        // lockDuration * ( (amountStaked * %lockRemaining) + (incomingAmount) ) / (amountStaked + incomingAmount)
        // Effectively equivalent to a weighted sum of the remaining time and the new incoming stake weighted at 100%
        // f(x) = aW_1 + bW_2 * k

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
            // incoming stake isnt locking
            staker.owedRewards += _getPendingRewards(staker, false);
            staker.lastTimestamp = block.timestamp;
            staker.amountStaked += amount;
        } else {
            // incoming stake is locking
            if (staker.unlockedTimestamp == 0) {
                // first time locking stake
                staker.lockDuration = lockDuration;
                staker.unlockedTimestamp = block.timestamp + lockDuration;
                staker.rewardsMultiplier = _calcRewardsMultiplier(lockDuration);
            } else {
                // TODO resolve what to do, for now just simple shift 
                staker.unlockedTimestamp = block.timestamp + staker.lockDuration;
            }

            // Must always update this before we update `lastTimestampLocked`
            staker.owedRewardsLocked += _getPendingRewards(staker, true);
            staker.lastTimestampLocked = block.timestamp;
            staker.amountStakedLocked += amount;
        }

        // Transfers users funds to this contract
        // User must have approved this contract
        SafeERC20.safeTransferFrom(IERC20(stakingToken), msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, lockDuration, stakingToken);
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
                    // Otherwise update locked values
                    staker.owedRewardsLocked = 0;
                    staker.amountStakedLocked = 0;
                    staker.lastTimestampLocked = 0;
                    staker.unlockedTimestamp = 0;
                }
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
