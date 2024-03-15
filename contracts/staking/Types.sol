// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface Types {
	/**
	 * @notice Enum to describe the types of available tokens that could be used in staking
	 */
	enum TokenType {
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
		TokenType stakingTokenType;
		uint256 rewardsPerBlock;
		uint256 minRewardsTime;
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
    struct StakeProfile {
        uint256 currentStakeNonce;
        mapping(uint256 stakeNonce => Stake _stakes) stakesMap;
    }
}