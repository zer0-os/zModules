// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
	 * @param stakingToken The ERC721 token that is being staked
	 * @param rewardsToken The ERC20 token that is being distributed as rewards
	 * @param rewardsVault The address of the vault that holds the rewards tokens
	 * @param stakingTokenType The type of token that is being staked (ERC721, ERC20, ERC1155)
	 * @param rewardsTokenType The type of token that is being distributed as rewards (ERC721, ERC20, ERC1155)
	 * @param rewardsPerBlock The amount of rewards tokens distributed per block
	 * @param minRewardsTime The minimum amount of time to have passed before a person can claim
     */
	struct PoolConfig { // TODO rename PoolConfig
		address stakingToken;
		address rewardsToken;
		address rewardsVault;
		TokenType stakingTokenType;
		TokenType rewardsTokenType;
		uint256 rewardsPerBlock;
		uint256 minRewardsTime;
        mapping(address => StakeConfig) stakes; // Details about a specific stake
	}

    struct StakeConfig { } // Details about a specific stake

    // Same as above but only reward in ERC20
    struct StakeConfigSimple {
		IERC20 rewardsToken;
		address stakingToken;
		address rewardsVault;
		TokenType stakingTokenType;
		uint256 rewardsPerBlock;
		uint256 minRewardsTime;
	}
}