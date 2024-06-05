// SPDX-License-Identifier: MIT
// solhint-disable immutable-vars-naming
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingBase } from "./IStakingBase.sol";


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
    mapping(address staker => Staker stakerData) public stakers;

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
     * @notice The length of a time period
     */
    uint256 public immutable periodLength;

    /**
     * @notice The amount of time required to pass to be able to claim or unstake
     */
    uint256 public immutable timeLockPeriod;

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _timeLockPeriod,
        address contractOwner
    ) Ownable(contractOwner) {
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
        timeLockPeriod = _timeLockPeriod;
    }

    /**
     * @notice Claim rewards for the calling user based on their staked amount
     */
    function claim() external override {
        // Require the time lock to have passed
        Staker storage staker = stakers[msg.sender];

        _onlyUnlocked(staker.unlockTimestamp);
        _baseClaim(staker);
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

    /**
     * @notice View the pending rewards balance for a user
     */
    function getPendingRewards() external view override returns (uint256) {
        return _getPendingRewards(stakers[msg.sender]);
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

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    function _checkRewards(Staker storage staker) internal {
        if (staker.amountStaked > 0) {
            // It isn't their first stake, snapshot pending rewards
            staker.owedRewards = _getPendingRewards(staker);
        } else {
            // Log the time at which this stake becomes claimable or unstakable
            // This is only done once per user
            staker.unlockTimestamp = block.timestamp + timeLockPeriod;
        }
    }

    function _baseClaim(Staker storage staker) internal {
        uint256 rewards = _getPendingRewards(staker);

        staker.lastUpdatedTimestamp = block.timestamp;
        staker.owedRewards = 0;

        // Disallow rewards when balance is 0
        if (_getContractRewardsBalance() == 0) {
            revert NoRewardsLeftInContract();
        }

        rewardsToken.safeTransfer(msg.sender, rewards);

        emit Claimed(msg.sender, rewards, address(rewardsToken));
    }

    function legacyPendingRewards() external view returns (uint256) {
        Staker memory staker = stakers[msg.sender];

        return
            staker.owedRewards +
            (rewardsPerPeriod *
                staker.amountStaked *
                ((block.timestamp - staker.lastUpdatedTimestamp) /
                    periodLength));
    }


    // can turn off auto mining in HH
    // maybe even turn it off in test?
    // either in HH config or in test itself
    function userMultiplier() external view returns (uint256) {
        Staker memory staker = stakers[msg.sender];

        return rewardsPerPeriod * staker.amountStaked;
    }

    function userRewardsPerFraction() external view returns (uint256) {
        Staker memory staker = stakers[msg.sender];

        return ((rewardsPerPeriod * staker.amountStaked) / periodLength);
    }

    function fullPeriodsPassed() external view returns (uint256) {
        Staker memory staker = stakers[msg.sender];

        return ((block.timestamp - staker.lastUpdatedTimestamp) / periodLength);
    }

    function fixedPeriodsRewards() external view returns (uint256) {
        Staker memory staker = stakers[msg.sender];

        return (rewardsPerPeriod * staker.amountStaked * this.fullPeriodsPassed());
    }

    function _getPendingRewards(
        Staker memory staker
    ) internal view returns (uint256) {
        // TODO optimize this function

        // Return any existing rewards they are owed plus the additional amount accrued
        // Value is prorated to a fractional period length
        // This means that calls will calculate rewards for the appropriate amount in between
        // periods, instead of just the full periods

        // Find how many periods have passed
        uint256 fullPeriodsPassed = ((block.timestamp - staker.lastUpdatedTimestamp) / periodLength);
        
        // The amount of the fractional period that has passed
        uint256 amountOfPeriodPassed = periodLength - (block.timestamp % periodLength);

        if (fullPeriodsPassed == 0) {
            return (amountOfPeriodPassed) * ((rewardsPerPeriod * staker.amountStaked) / periodLength);
        }
        // TODO fullperiods passed not right?
        // because of order of calls in test? (after stake)
        // block timestamp and last updated tomestamp = 0
        // so later division is zero


        // Calculate rewards owed for that number of periods
        uint256 fixedPeriodRewards = (rewardsPerPeriod * staker.amountStaked * fullPeriodsPassed);

        // TODO if not yet through a single period, `fixPeriodRewards` is zero
        // but this is used to calculate the partial rewards
        // find a second way to cal these not reliant on above

        // Divide by number of periods passed to get the 
        // user specific rewards given per period
        uint256 userRewardsPerPeriod = fixedPeriodRewards / fullPeriodsPassed;

        // Divide by period length to get the user specific rewards per single fraction of a period
        uint256 rewardsPerPeriodFraction = userRewardsPerPeriod / periodLength;

        // Return the full period rewards prorated up to the moment they call
        return fixedPeriodRewards + (rewardsPerPeriodFraction * amountOfPeriodPassed);
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
