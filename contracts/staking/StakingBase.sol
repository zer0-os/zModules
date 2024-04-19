// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IStakingBase } from "./IStakingBase.sol";

/**
 * @title StakingBase
 * @notice A set of common elements that comprise any Staking contract
 */
abstract contract StakingBase is IStakingBase {
    /**
     * @dev The staking token for this pool
     */
    address public immutable stakingToken;

    /**
     * @dev The rewards token for this pool
     */
    IERC20 public immutable rewardsToken;

    /**
     * @dev The rewards of the pool per period length
     */
    uint256 public immutable rewardsPerPeriod;

    /**
     * @dev The length of a time period
     */
    uint256 public immutable periodLength;

    /**
     * @dev The amount of time required to pass to be able to claim or unstake
     */
    uint256 public immutable timeLockPeriod;

	/**
     * @dev Mapping of each staker to that staker's data in the `Staker` struct
     */
    mapping(address staker => Staker stakerData) public stakers;

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _timeLockPeriod
    ) {
        stakingToken = _stakingToken;
        rewardsToken = _rewardsToken;
        rewardsPerPeriod = _rewardsPerPeriod;
        periodLength = _periodLength;
        timeLockPeriod = _timeLockPeriod;
    }

	/**
	 * @notice Claim rewards for the calling user based on their staked amount
	 */
	// TODO this is two reads of `stakers` mapping in the `unstake` flow
	function claim() public override {
		uint256 rewards = _baseClaim(stakers[msg.sender]);
        emit Claimed(rewards, address(rewardsToken));
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
    function getContractRewardsBalance() external view override returns (uint256) {
        return _getContractRewardsBalance();
    }

	////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

	function _ifRewards(Staker storage staker) internal {
		if (staker.amountStaked > 0) {
            // It isn't their first stake, snapshot pending rewards
            staker.pendingRewards = _getPendingRewards(staker);
        } else {
            // Log the time at which this stake becomes claimable or unstakable
            // This is only done once per user
            staker.unlockTimestamp = block.timestamp + timeLockPeriod;
        }
	}

	function _baseClaim(Staker storage staker) internal virtual returns(uint256) {
		// Require the time lock to have passed
        _onlyUnlocked(staker.unlockTimestamp);

        uint256 rewards = _getPendingRewards(staker);

		staker.lastUpdatedTimestamp = block.timestamp;
        staker.pendingRewards = 0;

        // Disallow rewards when balance is 0
        if (_getContractRewardsBalance() == 0) {
            revert NoRewardsLeftInContract();
        }

        rewardsToken.transfer(msg.sender, rewards);
		
		// For events
		return rewards;
	}

	function _getPendingRewards(
        Staker storage staker
    ) internal view returns (uint256) {
        // Return any existing pending rewards value plus the
        // calculated rewards based on the last updated timestamp
        return staker.pendingRewards +
			(rewardsPerPeriod * staker.amountStaked * (
					(block.timestamp - staker.lastUpdatedTimestamp) / periodLength)
				);
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