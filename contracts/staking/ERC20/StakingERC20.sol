// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingERC20 } from "./IStakingERC20.sol";
import { StakingBase } from "../StakingBase.sol";

/* solhint-disable no-console */
// TODO remove when ready
import { console } from "hardhat/console.sol";

/**
 * @title StakingERC20
 * @notice A staking contract for ERC20 tokens
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingERC20 is StakingBase, IStakingERC20 {
    // TODO when ERC20Voter token is ready add here

    using SafeERC20 for IERC20;

    uint256 public totalStaked;

    constructor(
        IERC20 _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _minimumLockTime,
        address contractOwner
    )
        StakingBase(
            address(_stakingToken),
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
            _minimumLockTime,
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
        if (lockDuration < minimumLockTime) {
            revert LockTimeTooShort();
        }
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
    function claim() external override {
        // transfer a user their owed rewards + any available pending rewards
        // if funds are locked, only transfer if they are past lock duration
        Staker storage staker = stakers[msg.sender];

        // Get rewards they've accumulated already as well as any pending rewards from their last timestamp
        uint256 rewards = _getPendingRewards(staker);

        staker.owedRewards = 0;
        staker.lastTimestamp = block.timestamp;

        if (staker.unlockedTimestamp != 0 && _getRemainingLockTime(staker) == 0) {
            // If the above is true, the rewards will have already been accounted for in
            // the first `_getPendingRewards` call
            // We only need to update here
            staker.owedRewardsLocked = 0;
            staker.lastTimestampLocked = block.timestamp;
        }

        // Do not transfer 0 rewards
        if (rewards == 0) revert ZeroRewards();

        // if (_getContractRewardsBalance() < rewards) revert InsufficientContractBalance();

        // Because we update timestamps before transfer, any reentrancy attempt
        // will use the current timestamps and calculate to 0
        rewardsToken.safeTransfer(msg.sender, rewards);

        emit Claimed(msg.sender, rewards, address(rewardsToken));
    }

    /**
     * @notice Unstake a specified amount of a user's non-locked stake
     * 
     * @param amount The amount to withdraw
     */
    function unstake(uint256 amount, bool exit) external override {
        _unstake(amount, false, exit);
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
        return _getPendingRewards(stakers[msg.sender]);
    }

    function _stake(uint256 amount, uint256 lockDuration) internal {
        // TODO be sure when new locks come in after an old lock is expired
        // it is treated like a brand new lock
        if (amount == 0) {
            revert ZeroValue();
        }

        Staker storage staker = stakers[msg.sender];

        if (lockDuration == 0) {
            // Get rewards they are owed from past unlocked stakes, if any
            // `_getPendingRewards` will return 0 if `amountStaked == 0`
            uint256 interimRewards =  _getInterimRewards(staker, block.timestamp - staker.lastTimestamp, false);
            // console.log("interimRewards", interimRewards);
            staker.owedRewards += interimRewards;
            staker.lastTimestamp = block.timestamp;
            staker.amountStaked += amount;
        } else {
            // Pre calculate the value of the stake
            uint256 stakeValue = _getStakeValue(amount, lockDuration, true);
            staker.owedRewardsLocked += stakeValue;

            uint256 incomingUnlockedTimestamp = block.timestamp + lockDuration;
            // if incoming is smaller, be sure we are not past, if so it is a new lock
            // otherwise update like below
            if (incomingUnlockedTimestamp > staker.unlockedTimestamp) {
                if (_getRemainingLockTime(staker) == 0) {
                    // If we have passed their previous lock duration entirely, then we 
                    // collect the rewards they are owed for the interim period at 1.0 RM and then
                    staker.owedRewardsLocked += 
                        _getInterimRewards(staker, block.timestamp - staker.unlockedTimestamp, true);
                }
                // On follow up stakes, if the incoming lock is longer than the existing remaining lock,
                // we use the incoming lock duration instead
                staker.unlockedTimestamp = incomingUnlockedTimestamp;
                staker.lockDuration = lockDuration;
            }

            staker.lastTimestampLocked = block.timestamp;
            staker.amountStakedLocked += amount;    
        }

        // Transfers user's funds to this contract
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

            if (_getRemainingLockTime(staker) > 0) {
                // Only allow use of exit on funds that are still locked
                if (exit) {           
                    rewards = 0;
                } else {
                    revert TimeLockNotPassed();
                }
            } else {
                // If staker's funds are unlocked, we ignore exit
                // We already added the value they are owed in stake when pre calculating
                // now we just add the value they are owed for interim rewards
                rewards = staker.owedRewardsLocked + _getInterimRewards(
                    staker,
                    block.timestamp - staker.unlockedTimestamp,
                    true
                );
            }

            // If removal of all locked funds
            if (staker.amountStakedLocked - amount == 0) {
                if (staker.amountStaked == 0) {
                    // and there are no non-locked funds, delete
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

            if (exit) {
                rewards = 0;
            } else {
                rewards = staker.owedRewards + _getInterimRewards(staker, block.timestamp - staker.lastTimestamp, false);
            }

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
            if (_getContractRewardsBalance() < rewards) revert InsufficientContractBalance();

            // Transfer the user's rewards
            rewardsToken.safeTransfer(msg.sender, rewards);
        }

        // Return the user's initial stake
        IERC20(stakingToken).safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, stakingToken);
    }

    function _getContractRewardsBalance() internal view override returns (uint256) {
        uint256 balance = super._getContractRewardsBalance();

        if (address(rewardsToken) == stakingToken) {
            return balance - totalStaked;
        }

        return balance;
    }
}
