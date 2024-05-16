// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingERC20 } from "./IStakingERC20.sol";
import { StakingBase } from "../StakingBase.sol";

/**
 * @title StakingERC20
 * @notice A staking contract for ERC20 tokens
 */
contract StakingERC20 is StakingBase, IStakingERC20 {
    using SafeERC20 for IERC20;

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _timeLockPeriod,
        address contractOwner
    )
        StakingBase(
            _stakingToken,
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
            _timeLockPeriod,
            contractOwner
        )
    {}

    /**
     * @notice Stake an amount of the ERC20 staking token specified
     * @param amount The amount to stake
     */
    function stake(uint256 amount) external override {
        Staker storage staker = stakers[msg.sender];

        if (amount == 0) {
            revert ZeroStake();
        }

        _checkRewards(staker);

        IERC20(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        staker.amountStaked += amount;
        staker.lastUpdatedTimestamp = block.timestamp;

        emit Staked(msg.sender, amount, stakingToken);
    }

    /**
     * @notice Unstake some or all of a user's stake
     * @param amount The amount to withdraw
     * @param exit If true, the user will unstake without claiming rewards (optional)
     */
    function unstake(uint256 amount, bool exit) external override {
        Staker storage staker = stakers[msg.sender];

        if (!exit) _onlyUnlocked(staker.unlockTimestamp);

        if (amount > staker.amountStaked) {
            revert UnstakeMoreThanStake();
        }

        if (!exit) {
            _baseClaim(staker);
        } else {
            // Snapshot their pending rewards
            staker.owedRewards = _getPendingRewards(staker);
        }

        if (staker.amountStaked - amount == 0) {
            delete stakers[msg.sender];
        } else {
            staker.amountStaked -= amount;
            staker.lastUpdatedTimestamp = block.timestamp;
        }

        // Return the user's initial stake
        IERC20(stakingToken).safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, stakingToken);
    }
}
