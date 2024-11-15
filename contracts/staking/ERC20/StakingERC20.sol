// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingERC20 } from "./IStakingERC20.sol";
import { StakingBase } from "../StakingBase.sol";

/**
 * @title StakingERC20
 * @notice A staking contract for ERC20 tokens
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingERC20 is StakingBase, IStakingERC20 {
    using SafeERC20 for IERC20;

    uint256 public totalStaked;

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
    function stake(uint256 amount) external override nonReentrant {
        Staker storage staker = stakers[msg.sender];

        if (amount == 0) {
            revert ZeroStake();
        }

        _checkRewards(staker);

        // this logic is here to support deflationary or rebasing tokens
        uint256 balanceBefore = IERC20(stakingToken).balanceOf(address(this));

        IERC20(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        uint256 balanceAfter = IERC20(stakingToken).balanceOf(address(this));
        uint256 amountTransferred = balanceAfter - balanceBefore;

        staker.amountStaked += amountTransferred;
        staker.lastUpdatedTimestamp = block.timestamp;

        totalStaked += amountTransferred;

        emit Staked(msg.sender, amount, amountTransferred, stakingToken);
    }

    /**
     * @notice Unstake some or all of a user's stake
     * @param amount The amount to withdraw
     * @param exit If true, the user will unstake without claiming rewards (optional)
     */
    function unstake(uint256 amount, bool exit) external override nonReentrant {
        if (amount == 0) revert ZeroUnstake();

        Staker storage staker = stakers[msg.sender];

        if (amount > staker.amountStaked) revert UnstakeMoreThanStake();

        if (!exit) {
            _onlyUnlocked(staker.unlockTimestamp);
            _baseClaim(staker, amount);
        } else {
            // test partial and full amount

            // Snapshot their pending rewards
            staker.owedRewards = _getPendingRewards(staker);
        }

        totalStaked -= amount;

        if (staker.amountStaked != 0) {
            staker.amountStaked -= amount;
            staker.lastUpdatedTimestamp = block.timestamp;
        }

        // Return the user's initial stake
        IERC20(stakingToken).safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, stakingToken);
    }

    function _getContractRewardsBalance() internal view override returns (uint256) {
        uint256 balance = super._getContractRewardsBalance();

        if (address(rewardsToken) == stakingToken) {
            return balance - totalStaked;
        }

        return balance;
    }
}
