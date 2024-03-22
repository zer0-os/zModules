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
	 * @param rewardsVault The address of the vault that holds the reward tokens
	 * @param stakingTokenType The type of token that is being staked (ERC721, ERC20, ERC1155)
	 * @param rewardsPerBlock The amount of rewards tokens distributed per block
	 * @param minRewardsTime The minimum amount of time to have passed before a person can claim
     */
	struct PoolConfig {
        address stakingToken;
		IERC20 rewardsToken;
		// TODO st: possibly add timeframe here based on which rewards will generate
		// HAS TO BE < 1! How do we denominate this one then? 10^18?
		uint256 rewardsPerPeriod; // amount of rewards distributed per period
        uint256 rewardsFraction; // fraction of stakeAmount that is multiplier in rewards calc
		uint256 rewardsPeriod; // length of a time period, specified in days
		uint256 timeLockPeriods; // number of time periods required to pass to be able to claim rewards or unstake
	}

    // Details of a single stake
    struct Stake {
        bytes32 poolId;
        uint256 tokenId;
        uint256 amount;
        uint256 index;
        uint256 stakedOrClaimedAt;
    }

    // Details of all stakes for a single user
    struct StakerProfile {
        uint256 currentStakeNonce;
		// TODO st: remove this and calc the rewards on stake() if previous stakes exist
        // mapping(uint256 stakeNonce => Stake _stakes) stakesMap;
    }
}
