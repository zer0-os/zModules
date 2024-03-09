// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


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
     * @param rewardsPerBlock The amount of rewards tokens distributed per block
     */
	struct StakeConfig {
		address stakingToken;
		address rewardsToken;
		address rewardsVault;
		TokenType stakingTokenType;
		TokenType rewardsTokenType;
		uint256 rewardsPerBlock;
		uint256 minRewardsTime; // minimum amount of time to have passed before a person can claim
	}
}