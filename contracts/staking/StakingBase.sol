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

/**
 * @title StakingBase
 * @notice A set of common elements that are used in any Staking contract
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingBase is Ownable, ReentrancyGuard, IStakingBase {
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
     * @notice The minimum amount of time a user must lock their stake for
     */
    uint256 public minimumLockTime;

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _minimumLockTime,
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
        minimumLockTime = _minimumLockTime;
    }

    /**
     * @notice Emergency function for the contract owner to withdraw leftover rewards
     * in case of an abandoned contract.
     * @dev Can only be called by the contract owner. Emits a `RewardFundingWithdrawal` event.
     */
    function withdrawLeftoverRewards() public override onlyOwner {
        uint256 balance = _getContractRewardsBalance();

        // Do not send empty transfer
        if (balance == 0) revert InsufficientContractBalance();

        rewardsToken.safeTransfer(owner(), balance);

        emit LeftoverRewardsWithdrawn(owner(), balance);
    }

    /**
     * @notice Get the minimum lock time
     */
    function getMinimumLockTime() public view override returns(uint256) {
        return minimumLockTime;
    }

    /**
     * @notice Set the minimum lock time
     * @dev Will fail when called by anyone other than the contract owner
     * 
     * @param _minimumLockTime The new minimum lock time, in seconds
     */
    function setMinimumLockTime(uint256 _minimumLockTime) public override onlyOwner {
        minimumLockTime = _minimumLockTime;
        emit MinimumLockTimeSet(owner(), _minimumLockTime);
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance() public view override returns (uint256) {
        return _getContractRewardsBalance();
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

    function _coreStake(
        Staker storage staker,
        uint256 amount, // also tokenIds.length, in ERC721 case
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
                // The user has never locked
                // or they have and we are past their lock period

                // Capture the user's owed rewards from the past stake in between
                // period at rate of 1
                // Note: this will return 0 if `amountStakedLocked == 0`
                staker.owedRewardsLocked += _getStakeRewards(
                    staker.amountStakedLocked,
                    1,
                    lockDuration,
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

        rewardsToken.safeTransfer(msg.sender, rewards);

        emit Claimed(msg.sender, rewards, address(rewardsToken));
    }

    function _getRemainingLockTime(Staker storage staker) internal view returns(uint256) {
        if (staker.amountStakedLocked == 0 || staker.unlockedTimestamp < block.timestamp) return 0;

        return staker.unlockedTimestamp - block.timestamp;
    }

    function _getStakeRewards(
        uint256 amount,
        uint256 rewardsMultiplier,
        uint256 timeDuration,
        bool locked
    ) internal view returns(uint256) {
        uint256 divisor = locked ? 100000 : 1000;

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
        uint256 rewards = staker.owedRewards + _getStakeRewards(
            staker.amountStaked,
            staker.rewardsMultiplier,
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
        // could argue that have a minimum lock time is a good idea?
        // could help make sure people cant exploit the system
        // you cant lock for 1s just to get RM and boost rewards

        // use 1 + to avoid ever having 0 return value
        // if we want 30 day min lock time 259 is a good divisor
        // for both ERC20 and ERC721 staking contracts 

        return 1 + 1e14 * 10 * ( (lock * 10 ) / 259) / 1e18;
        // return 100 + 1e18 * 10**(lock / 365) / 1e16; // might be better
        // return 101 + 1e14 * 10 * ( (lock * 10 ) / 365) / 1e18;
    }

    function _getContractRewardsBalance() internal view virtual returns (uint256) {
        return rewardsToken.balanceOf(address(this));
    }
}
