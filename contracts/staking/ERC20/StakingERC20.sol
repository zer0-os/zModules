// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// import { ERC721NonTransferrable } from "../../tokens/ERC721NonTransferrable.sol";
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
	
		// TODO do we want this?
		// every staker pays gas for this niche check
		// and if staker does transfer 0 nothing happens
		// they just wasted their own funds paying the gas =s
		if (amount == 0) {
			revert ZeroStake();
		}

		// TODO mint on first stake, burn on full withdrawal?
		// burn at all?
		// mint at all?
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

	// TODO create 'unstakeAll' helper so `amount` is not a required param

    function unstake(uint256 amount, bool exit) external override {
        Staker storage staker = stakers[msg.sender];

		// TODO claim does its own _onluUnlocked check
		// remove check here? or remove in claim?
		// maybe make internal _baseClaim without it, and public claim with it?
        if (!exit) _onlyUnlocked(staker.unlockTimestamp);

		if (amount > staker.amountStaked) {
			revert UnstakeMoreThanStake();
		}

		IERC20(stakingToken).transfer(
            msg.sender,
            amount
        );

		if (!exit) {
			// TODO reads `stakers` mapping twice
			// cant do storage param though?
			claim();
		} else {
			// we still have to update their pending rewards
			// because otherwise we adjust the balance but skip adjusting the rewards
			// so they do not earn the rewards they should earn
			staker.pendingRewards = _getPendingRewards(staker);
		}

        staker.amountStaked -= amount;

		if (staker.amountStaked == 0) {
            delete stakers[msg.sender];
        } else {
            staker.lastUpdatedTimestamp = block.timestamp;
        }

		emit Unstaked(amount, stakingToken);
	}
}