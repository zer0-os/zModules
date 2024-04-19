// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721NonTransferrable } from "../../tokens/ERC721NonTransferrable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IStakingERC20 } from "./IStakingERC20.sol";
import { StakingBase } from "../StakingBase.sol";


/**
 * @title StakingERC20
 * @notice A staking contract for ERC20 tokens
 */
contract StakingERC20 is ERC721NonTransferrable, StakingBase, IStakingERC20 {
	/**
     * @dev Revert if a call is not from the SNFT owner
     */
	modifier onlySNFTOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner();
        }
        _;
    }

    constructor(
		string memory name,
		string memory symbol,
		address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _timeLockPeriod
	)
        ERC721NonTransferrable(name, symbol)
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
	
		_ifRewards(staker);

		IERC20(stakingToken).transferFrom(
            msg.sender,
            address(this),
            amount
        );

		emit Staked(amount, stakingToken);
	}

    function unstake(uint256 amount, bool exit) external override {
        Staker storage staker = stakers[msg.sender];

        _onlyUnlocked(staker.unlockTimestamp);

		if (amount > staker.amountStaked) {
			revert UnstakeMoreThanStake();
		}

		IERC20(stakingToken).transferFrom(
            address(this),
            msg.sender,
            amount
        );

		if (!exit) {
			// TODO reads `stakers` mapping twice
			// cant do storage param though?
			claim();
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