// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IStakingERC20 } from "./IStakingERC20.sol";
import { StakingBase } from "../StakingBase.sol";


/**
 * @title StakingERC20
 * @notice A staking contract for ERC20 tokens
 */
contract StakingERC20 is StakingBase, IStakingERC20 {
    constructor(
		address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _timeLockPeriod
	)
        StakingBase(
            _stakingToken,
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
            _timeLockPeriod
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

		_ifRewards(staker);

		IERC20(stakingToken).transferFrom(
            msg.sender,
            address(this),
            amount
        );

		staker.amountStaked += amount;
		staker.lastUpdatedTimestamp = block.timestamp;

		emit Staked(amount, stakingToken);
	}

    function unstake(uint256 amount, bool exit) external override {
        Staker storage staker = stakers[msg.sender];

        if (!exit) _onlyUnlocked(staker.unlockTimestamp);

		if (amount > staker.amountStaked) {
			revert UnstakeMoreThanStake();
		}

		IERC20(stakingToken).transfer(
            msg.sender,
            amount
        );

		if (!exit) {
			_baseClaim(staker);
		} else {
			// Snapshot their pending rewards
			staker.owedRewards = _getPendingRewards(staker);
		}

		if (staker.amountStaked - amount == 0) {
            delete stakers[msg.sender];
        } else {
			// should we update their rewards amount owed here?
			staker.amountStaked -= amount;
            staker.lastUpdatedTimestamp = block.timestamp;
        }

		emit Unstaked(amount, stakingToken);
	}

	function helpful(Staker memory staker, uint256 amount) external view returns (uint256, uint256) {
		return (staker.amountStaked, amount);
	}
}