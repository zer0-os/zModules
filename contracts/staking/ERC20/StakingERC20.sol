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

    /**
     * We want to add functionality that allows users to lock their stake for a period of time
     * they get a reward bonus multiplier for doing so, and the longer they lock, the higher the multiplier
     * 
     * Do we still want `_timeLockPeriod` as part of the constructor here? Where a minimum amount of time has to pass before
     * a user can claim their rewards? Or do we want to remove that and replace it with the lock periodthey specify?
     * 
     * Are they REQUIRED to lock for any period of time? Or is it optional?
     * 
     * If locking is optional we can remove `timeLockPeriod` entirely
     * If locking is not optional, then `timeLockPeriod` can be used to represent the minimum locking time
     * 
     * 
     * Do we want the lock multiplier to be some curve function? Or just a fixed array of values
     *  If using the simplest approach like neo recommended, just having an array of  some simple values makes more sense
     * 
     * 
     * How do we handle second and third stakes?
     *  Locked independently? Or do they all share the same lock period?
     * 
     *  e.g. stake 1 for 30 days and get lock multiplier of X, then add and reset the 30 day waiting period by now the 
     *  multiplier is X+1
     * 
     * or
     * 
     * the second and further stakes are locked independently of each other, so a user could have an array of lock periods
     * and multipliers
     * 
     * Stakes dont care about each other, so no existing rewards come from the previous stake
     * e.g. staked A for 30 days, multiplier is X
     * staked B for 60 days, multiplier is Y
     * 
     * TODO how much should RM increase based on lock time? 30 days = 1 RM? It should scale so its exponential in value to incentivize
     * longer lock times
     * 
     * RMs should be configurable, simplest to have them all start at a base value
     * 
     * RMs (We could scale these appropriately so even if the number is larger its not the same as just X*Y)
     * MAYBE we do `1/x` multiplier where `x` starts at 365 and the longer your stake is, the smaller `x` becomes so the multiplier is larger
     * that  way when you reach 1/1 you're at the "full" rewards amount
     * 1, 2, 3, 5, 8, 11, 19, 30, 49, 79
     * 
     * Days
     * 30, 60, 90, 120, 150, 180, 210, 240, 270, 300
     * 
     * A) Has never staked
     *  1) Does incoming stake have lock time?
     *      - if yes, set lock and RM for that duration appropriately
     *      - if no, set lock to 0 and RM to 1
     * 
     * B) Has staked before
     *  1) Does incoming stake have lock time?
     *      - if so, set lock for this amount and set RM appropriately (each stake is independent?)
     *      - if not, combine with 0 lock value
     *    
     * 
     * case 1: user who has never staked enters stake for 20 that is not locked, RM is 1, can claim or unlock at any time
     * case 2: user who has never staked enters stake for 20 that is locked for 30 days, RM is 2, can claim or unlock at any time
     * 
     * case 3: user who HAS staked WITHOUT locking enters another stake for more, this is combined with stake that has 1 RM
     * case 4: user who HAS staked WITH locking enters another stake, this is NOT combined with existing stake
     * 
     * Can users contribute to existing stake that is locked? 
     *  i.e. you have A locked for X time, then you add B amount after T elapses, so now stake is A+B but lock time resets
     *  rewards generated so far are assigned to the user, but not yet actually transferred to them
     */

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
     * @notice Unstake some or all of a user's stake
     * @param amount The amount to withdraw
     * @param exit If true, the user will unstake without claiming rewards (optional)
     */
    function unstake(uint256 amount, bool exit) external override {
        // Staker storage staker = stakers[msg.sender];

        // // if (!exit) _onlyUnlocked(staker.unlockTimestamp);

        // if (amount > staker.amountStaked) {
        //     revert UnstakeMoreThanStake();
        // }

        // if (!exit) {
        //     _baseClaim(staker);
        // } else {
        //     // Snapshot their pending rewards
        //     staker.owedRewards = _getPendingRewards(staker);
        // }

        // if (staker.amountStaked - amount == 0) {
        //     delete stakers[msg.sender];
        // } else {
        //     staker.amountStaked -= amount;
        // }

        // Return the user's initial stake
        IERC20(stakingToken).safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, stakingToken);
    }

    // TODO consider adding an ability to unlock a stake so users can access their funds if they want to,
    // but they forfeit the rewards they would have earned if they had kept it locked, so it gets rewards
    // as though it was never locked in the first place
    function _unlock() internal {
        // unlock a stake for a user, removing their extra rewards
        // but allowing them to access their funds immediately
    }



    // TODO both additional claims AND additional stakes can reduce long term ROI
        // as exponential from last touch point. Consider changing the rewards math to be simpler
        // e.g. establish multiplier upon initial stake and always just use that multiplier
        // This could be gamed because you if your multiplier is only based on the length of stake

        // you could stake 1 for 1 year to get a big multiplier, then add 10000 at the end and claim it rapidly to
        // get that large multiplier on 10001 total, UNLESS we snapshot rewards properly on new stakes
        // you get (RM * stakeBalance * lengthOfStake) assigned to you when you make a new stake, then going forward
        // rewards are calculated only at your new balance based on your last touchpoint

/**
         * TODO CASES
         * [x] first stake EVER, want lock
         *      set amountStakedLocked
         *      set unlockedTimestamp
         *      set lastTimestamp
         * [x] first stake EVER, do not want lock
         *      set amountStaked
         *      set lastTimestamp
         * 
         * [] NOT first stake, have never locked, lock
         *      update owedRewards with weighted sum math
         *      set amountStakedLocked
         *      set unlockedTimestamp
         *      update lastTimestamp
         * 
         * [] NOT first stake, have never locked, no lock
         *      update owedRewards with weighted sum math
         *      update amountStaked
         *      update lastTimestamp
         *
         *
         * [] NOT first stake, have locked, add more to lock
         *      updated owedRewards
         * [] NOT first stake, have locked, add to unlocked
         */

    // Adjust the appropriate number of days for a stake
    function weightedSumFunction() public returns(uint256) {
        // TODO implement
        return 1;
    }

    function _stake(uint256 amount, uint256 lockDuration) internal {
        if (amount == 0) {
            revert ZeroStake();
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
                staker.unlockedTimestamp = block.timestamp + lockDuration;
            } else {
                // console.log("4");

                // If adding balance to a staking pool that exists
                // we use the weighted sum of % days left and total 
                // balance of new amount staked to determine how many days
                // to add to the `unlockedTimestamp` of a user
                staker.unlockedTimestamp = weightedSumFunction();
            }

            staker.lastTimestampLocked = block.timestamp;
            staker.owedRewardsLocked += _getPendingRewards(staker, true);
            staker.amountStakedLocked += amount;
        }

        // Transfers users funds to this contract
        // TODO a vault instead? would be more expensive
        SafeERC20.safeTransferFrom(IERC20(stakingToken), msg.sender, address(this), amount);

        emit Staked(msg.sender, amount, stakingToken);
    }
}
