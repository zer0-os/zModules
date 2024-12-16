// SPDX-License-Identifier: MIT
// solhint-disable immutable-vars-naming
pragma solidity ^0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingBase } from "./IStakingBase.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/* solhint-disable no-console */
import { console } from "hardhat/console.sol";
// TODO remove when ready

/**
 * @title StakingBase
 * @notice A set of common elements that are used in any Staking contract
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingBase is Ownable, ReentrancyGuard, IStakingBase {
    using SafeERC20 for IERC20;

    // Constant values for precision in rewards calculations
    uint256 constant public PRECISION_DIVISOR = 1000;
    uint256 constant public LOCKED_PRECISION_DIVISOR = 100000;

    /**
     * @notice Mapping of each staker to that staker's data in the `Staker` struct
     */
    mapping(address user => Staker staker) public stakers;

    /**
     * @notice All required config variables, specified in the `Config` struct in `IStakingBase.sol`
     */
    Config public config;

    constructor(
        Config memory _config
    ) Ownable(_config.contractOwner) {
        if (
            _config.stakingToken.code.length == 0 ||
            address(_config.rewardsToken).code.length == 0 ||
            _config.rewardsPerPeriod == 0 ||
            _config.periodLength == 0
        ) revert InitializedWithZero();
        config = _config;
    }

    /**
     * @notice Emergency function for the contract owner to withdraw leftover rewards
     * in case of an abandoned contract.
     *
     * @dev Can only be called by the contract owner. Emits a `RewardFundingWithdrawal` event.
     */
    function withdrawLeftoverRewards() public override onlyOwner {
        uint256 balance = _getContractRewardsBalance();

        // Do not send empty transfer
        if (balance == 0) revert InsufficientContractBalance();

        config.rewardsToken.safeTransfer(owner(), balance);

        emit LeftoverRewardsWithdrawn(owner(), balance);
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance() public view override returns (uint256) {
        return _getContractRewardsBalance();
    }

    /**
     * @notice Get the staking token address
     */
    function getStakingToken() public view override returns (address) {
        return config.stakingToken;
    }

    /**
     * @notice Get the rewards token address
     */
    function getRewardsToken() public view override returns (IERC20) {
        return config.rewardsToken;
    }

    /**
     * @notice Get the rewards per period
     */
    function getRewardsPerPeriod() public view override returns (uint256) {
        return config.rewardsPerPeriod;
    }

    /**
     * @notice Get the period length
     */
    function getPeriodLength() public view override returns (uint256) {
        return config.periodLength;
    }

    /**
     * @notice Get the minimum lock time
     */
    function getMinimumLockTime() public view override returns(uint256) {
        return config.minimumLockTime;
    }

    /**
     * @notice Get the minimum rewards multiplier
     */
    function getMinimumRewardsMultiplier() public view override returns(uint256) {
        return config.minimumRewardsMultiplier;
    }

    /**
     * @notice Get the maximum rewards multiplier
     */
    function getMaximumRewardsMultiplier() public view override returns(uint256) {
        return config.maximumRewardsMultiplier;
    }

    /**
     * @notice Set the rewards per period
     * @dev Will fail when called by anyone other than the contract owner
     *
     * @param _rewardsPerPeriod The new rewards per period value
     */
    function setRewardsPerPeriod(uint256 _rewardsPerPeriod) public override onlyOwner {
        config.rewardsPerPeriod = _rewardsPerPeriod;
    }

    /**
     * @notice Set the period length
     * @dev Will fail when called by anyone other than the contract owner
     *
     * @param _periodLength The new period length value
     */
    function setPeriodLength(uint256 _periodLength) public override onlyOwner {
        config.periodLength = _periodLength;
    }

    /**
     * @notice Set the minimum lock time
     * @dev Will fail when called by anyone other than the contract owner
     *
     * @param _minimumLockTime The new minimum lock time, in seconds
     */
    function setMinimumLockTime(uint256 _minimumLockTime) public override onlyOwner {
        config.minimumLockTime = _minimumLockTime;
        emit MinimumLockTimeSet(owner(), _minimumLockTime);
    }

    /**
     * @notice Set the minimum rewards multiplier
     * @dev Will fail when called by anyone other than the contract owner
     *
     * @param _minimumRewardsMultiplier The new minimum rewards multiplier value
     */
    function setMinimumRewardsMultiplier(uint256 _minimumRewardsMultiplier) public override onlyOwner {
        config.minimumRewardsMultiplier = _minimumRewardsMultiplier;
    }

    /**
     * @notice Set the maximum rewards multiplier
     * @dev Will fail when called by anyone other than the contract owner
     *
     * @param _maximumRewardsMultiplier The new maximum rewards multiplier value
     */
    function setMaximumRewardsMultiplier(uint256 _maximumRewardsMultiplier) public override onlyOwner {
        config.maximumRewardsMultiplier = _maximumRewardsMultiplier;
    }

    /**
     * @notice Return the potential rewards that would be earned for a given stake
     *
     * @param amount The amount of the staking token to calculate rewards for
     * @param timeDuration The the amount of time these funds will be staked, provide the lock duration if locking
     * @param locked Boolean if the stake is locked
     */
    function getStakeRewards(uint256 amount, uint256 timeDuration, bool locked) public view returns (uint256) {

        uint256 rewardsMultiplier = locked ? _calcRewardsMultiplier(timeDuration) : 1;

        return _getStakeRewards(
            amount,
            rewardsMultiplier,
            timeDuration,
            locked
        );
    }

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    /**
     * @dev Core stake functionality used by both StakingERC20 and StakingERC721
     * @param staker The user that is staking
     * @param amount The amount to stake
     * @param lockDuration The duration to lock the stake for, in seconds
     */
    function _coreStake(
        Staker storage staker,
        uint256 amount, //     tokenIds.length, in ERC721 case
        uint256 lockDuration
    ) internal {
        if (lockDuration == 0) {
            // Get rewards they are owed from past unlocked stakes, if any
            // will return 0 if `amountStaked == 0`
            staker.owedRewards += _getStakeRewards(
                staker.amountStaked,
                1, // Rewards multiplier is 1 for non-locked funds
                block.timestamp - staker.lastTimestamp,
                false
            );

            staker.lastTimestamp = block.timestamp;
            staker.amountStaked += amount;
        } else {
            if (block.timestamp > staker.unlockedTimestamp) {
                // The user has never locked or they have and we are past their lock period

                // Capture the user's owed rewards from the past stake in between
                // period at rate of 1
                uint256 mostRecentTimestamp = staker.lastTimestampLocked > staker.unlockedTimestamp
                    ? staker.lastTimestampLocked
                    : staker.unlockedTimestamp;

                // Note: this will return 0 if `amountStakedLocked == 0`
                staker.owedRewardsLocked += _getStakeRewards(
                    staker.amountStakedLocked,
                    1,
                    block.timestamp - mostRecentTimestamp,
                    false
                );

                // Then we update appropriately
                staker.unlockedTimestamp = block.timestamp + lockDuration;
                staker.lockDuration = lockDuration;
                staker.rewardsMultiplier = _calcRewardsMultiplier(lockDuration);

                // We precalculate the amount because we know the time frame
                staker.owedRewardsLocked += _getStakeRewards(
                    amount,
                    staker.rewardsMultiplier,
                    lockDuration,
                    true
                );
            } else {
                // Rewards value of the incoming stake given the remaining lock time
                staker.owedRewardsLocked += _getStakeRewards(
                    amount,
                    staker.rewardsMultiplier,
                    _getRemainingLockTime(staker),
                    true
                );
            }

            staker.lastTimestampLocked = block.timestamp;
            staker.amountStakedLocked += amount;
        }
    }

    /**
     * @dev Core claim functionality used by both StakingERC20 and StakingERC721
     * @param staker The staker to claim rewards for
     */
    function _coreClaim(Staker storage staker) internal {
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

        if (rewards == 0) revert ZeroRewards();

        config.rewardsToken.safeTransfer(msg.sender, rewards);

        emit Claimed(msg.sender, rewards);
    }

    /**
     * @dev Calculate the time remaining for a staker's lock. Return 0 if no locked funds or if passed lock time
     * @param staker The staker to get the lock time for
     */
    function _getRemainingLockTime(Staker storage staker) internal view returns(uint256) {
        if (staker.amountStakedLocked == 0 || staker.unlockedTimestamp < block.timestamp) return 0;

        return staker.unlockedTimestamp - block.timestamp;
    }

    /**
     * @dev Calculate the rewards for a specific stake
     * @param amount The amount of the staking token to calculate rewards for
     * @param rewardsMultiplier The multiplier for the rewards
     * @param timeDuration The amount of time these funds will be staked
     * @param locked Boolean if the stake is locked
     */
    function _getStakeRewards(
        uint256 amount,
        uint256 rewardsMultiplier,
        uint256 timeDuration,
        bool locked
    ) internal view returns (uint256) {
        uint256 divisor = locked ? LOCKED_PRECISION_DIVISOR : PRECISION_DIVISOR;
        // console.log("rewardsMultiplier: ", rewardsMultiplier);
        // console.log("amount: ", amount);
        // console.log("config.rewardsPerPeriod: ", config.rewardsPerPeriod);
        // console.log("timeDuration: ", timeDuration);
        // console.log("config.periodLength: ", config.periodLength);
        // console.log("divisor: ", divisor);
        // console.log("---");


        return rewardsMultiplier * amount * config.rewardsPerPeriod * timeDuration / config.periodLength / divisor;
    }

    /**
     * @dev Get the total rewards owed to a staker
     * @param staker The staker to get rewards for
     */
    function _getPendingRewards(Staker storage staker) internal view returns (uint256) {
        // Get rewards from non-locked funds already accrued and also between the last timestamp and now
        uint256 rewards = staker.owedRewards + _getStakeRewards(
            staker.amountStaked,
            1, // Rewards multiplier
            block.timestamp - staker.lastTimestamp,
            false
        );

        // Only include rewards from locked funds the user is passed their lock period
        if (staker.unlockedTimestamp != 0 && _getRemainingLockTime(staker) == 0) {
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

            rewards += staker.owedRewardsLocked + _getStakeRewards(
                staker.amountStakedLocked,
                1, // Rewards multiplier
                block.timestamp - mostRecentTimestamp,
                false // Treat as non-locked funds
            );
        }

        return rewards;
    }

    // todo remove when finished
    function testRM(uint256 timeDuration) public view returns (uint256) {
        return _calcRewardsMultiplier(timeDuration);
    }

    function _mostRecentTimestamp(Staker storage staker) internal view returns (uint256) {
        return staker.lastTimestampLocked > staker.unlockedTimestamp
            ? staker.lastTimestampLocked
            : staker.unlockedTimestamp;
    }

    /**
     * @dev Locked rewards receive a multiplier based on the length of the lock
     * @param lock The length of the lock in seconds
     */
    function _calcRewardsMultiplier(uint256 lock) internal view returns (uint256) {
        return config.minimumRewardsMultiplier
        + (config.maximumRewardsMultiplier - config.minimumRewardsMultiplier)
        * (lock )
        / config.periodLength;
    }

    function _getContractRewardsBalance() internal view virtual returns (uint256) {
        return config.rewardsToken.balanceOf(address(this));
    }
}
