// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";


interface Types {
	/**
	 * @notice Enum to describe the types of available tokens that could be used in staking
	 */
	enum TokenType { // TODO need this anymore?
		IERC721,
		IERC20,
		IERC1155
	}

	/**
	 * @notice The necessary details for a single staking pool comfiguration
	 * @param stakingToken The token that is being staked
	 * @param rewardsToken The ERC20 token that is being distributed as rewards
	 * @param poolWeight The weight of the pool in the rewards calculation
	 * @param periodLength The length of a time period
	 * @param timeLockPeriod The amount of time required to pass to be able to claim or unstake
     */
	struct PoolConfig {
        address stakingToken;
		IERC20 rewardsToken;
		// TODO st: possibly add timeframe here based on which rewards will generate
		// HAS TO BE < 1! How do we denominate this one then? 10^18?
		// uint256 rewardsPerPeriod; // amount of rewards distributed per period
        uint256 poolWeight; // fraction of stakeAmount that is multiplier in rewards calc
		uint256 periodLength; // length of a time period
		uint256 timeLockPeriod; // number of time periods required to pass to be able to claim or unstake
	}

    struct Stake{
        // amount = tokenIds.length
        uint256 unlockTimestamp;
        uint256 pendingRewards;
        uint256 lastUpdatedTimestamp;
        uint256 numStaked; // maybe just be numStakes or balanceStaked, etc.
        uint256[] tokenIds;
    }

    // TODO stakingTokenType, try without until 1155 and see what's necessary
    // might need for pool validation on creation
    // maybe add address of token that was staked, e.g. stakingToken contract
}
