// SPDX-License-Identifier: MIT
// solhint-disable immutable-vars-naming
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingBase } from "./IStakingBase.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/**
 * @title StakingBase
 * @notice A set of common elements that are used in any Staking contract
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingBase is Ownable, ReentrancyGuard, IStakingBase {
    using SafeERC20 for IERC20;

    // Constant values for precision in rewards calculations
    uint256 constant public PRECISION_DIVISOR = 1000;
    uint256 constant public LOCKED_PRECISION_DIVISOR = 100000;

    /**
     * @notice All required config variables, specified in the `RewardConfig` struct in `IStakingBase.sol`
     */

    /**
     * @notice The address of the staking token
     */
    address public immutable stakingToken;

    /**
     * @notice The address of the rewards token
     */
    address public immutable rewardsToken;

    /**
     * @notice The address of the representative token minted with each stake
     */
    address public immutable stakeRepToken;

    /**
     * @notice List of timestamps that mark when a config was set
     */
    uint256[] public override rewardConfigTimestamps;

    /**
     * @notice Struct to hold each config we've used and when it was implemented
     */
    mapping(uint256 timestamp => RewardConfig rewardConfig) public rewardConfigs;

    constructor(
        address _contractOwner,
        address _stakingToken,
        address _rewardsToken,
        address _stakeRepToken,
        RewardConfig memory _rewardConfig
    ) Ownable(_contractOwner) {
        if (
            _rewardConfig.rewardsPerPeriod == 0 ||
            _rewardConfig.periodLength == 0
        ) revert InitializedWithZero();

        // Disallow use of native token as stakeRepToken
        if (_stakeRepToken.code.length == 0) {
            revert InvalidAddress();
        }

        stakingToken = _stakingToken;
        rewardsToken = _rewardsToken;
        stakeRepToken = _stakeRepToken;

        // Initial config
        _rewardConfig.timestamp = block.timestamp;
        rewardConfigTimestamps.push(block.timestamp);
        rewardConfigs[block.timestamp] = _rewardConfig;
    }

    // We must be able to receive in the case that the
    // `stakingToken` is the chain's native token
    receive() external override payable {}

    /**
     * @notice Emergency function for the contract owner to withdraw leftover rewards
     * in case of an abandoned contract.
     *
     * @dev Can only be called by the contract owner. Emits a `RewardFundingWithdrawal` event.
     */
    function withdrawLeftoverRewards() public override onlyOwner {
        uint256 balance = _getContractRewardsBalance();

        // Do not send empty transfer
        if (balance == 0) revert InsufficientContractBalance();

        _transferAmount(rewardsToken, balance);

        emit LeftoverRewardsWithdrawn(owner(), balance);
    }

    /**
     * @notice Set the config for the staking contract
     * @dev Setting a value to the value it already is will not add extra gas
     * so it is cheaper to set the entire config than to have individual setters
     *
     * @param _config The incoming reward config
     */
    function setRewardConfig(RewardConfig memory _config) public override nonReentrant onlyOwner {
        if (
            _config.maximumRewardsMultiplier < _config.minimumRewardsMultiplier
        ) revert InvalidMultiplierPassed();

        if (_config.periodLength == 0) revert InitializedWithZero();

        // Disallow the possibility of setting two configs within the same block
        if (_getLatestConfig().timestamp == block.timestamp) revert LastConfigTooSoon();

        _config.timestamp = block.timestamp;
        rewardConfigTimestamps.push(block.timestamp);
        rewardConfigs[block.timestamp] = _config;

        emit RewardConfigSet(_config);
    }

    /**
     * @notice Return the potential rewards that would be earned for a given stake
     * @dev When `locked` is true, `timeOrDuration is a the duration of the lock period
     * @dev When `locked` is false, `timeOrDuration` is a past timestamp of the most recent action
     *
     * @param timeOrDuration The the amount of time given funds are staked, provide the lock duration if locking
     * @param amount The amount of the staking token to calculate rewards for
     * @param locked Boolean if the stake is locked
     */
    function getStakeRewards(
        uint256 timeOrDuration,
        uint256 amount,
        bool locked
    ) public override view returns (uint256) {
        return _getStakeRewards(
            timeOrDuration,
            amount,
            locked ? _calcRewardsMultiplier(timeOrDuration) : 1,
            locked
        );
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance() public view override returns (uint256) {
        return _getContractRewardsBalance();
    }

    function getLatestConfig() public view override returns (RewardConfig memory) {
        return _getLatestConfig();
    }

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    /**
     * @dev Core stake functionality used by both StakingERC20 and StakingERC721
     * @param staker The user that is staking
     * @param amount The amount to stake
     * @param lockDuration The duration to lock the stake for, in seconds
     */
    function _coreStake(
        Staker storage staker,
        uint256 amount,
        uint256 lockDuration
    ) internal {
        if (lockDuration == 0) {
            // Get staker rewards for this or past rewardConfigs as necessary
            if (staker.amountStaked > 0) {
                staker.owedRewards += _getStakeRewards(
                    staker.lastTimestamp,
                    staker.amountStaked,
                    1, // Rewards multiplier is 1 for non-locked funds
                    false
                );
            }

            staker.lastTimestamp = block.timestamp;
            staker.amountStaked += amount;
        } else {
            uint256 durationToUse;
            if (block.timestamp > staker.unlockedTimestamp) {
                // The user has never locked or they have and we are past their lock period
                uint256 amountStakedLocked = staker.amountStakedLocked;
                if (amountStakedLocked > 0) {
                    // Move locked owed rewards to non-locked owed rewards
                    staker.owedRewards += staker.owedRewardsLocked + _getStakeRewards(
                        _mostRecentTimestamp(staker),
                        amountStakedLocked,
                        1, // Rewards multiplier is 1 for non-locked funds
                        false
                    );

                    // Move locked stake balance to non-locked stake
                    staker.amountStaked += amountStakedLocked;
                    staker.lastTimestamp = block.timestamp;

                    // Reset user's locked rewards and staked amount
                    staker.owedRewardsLocked = 0;
                    staker.amountStakedLocked = 0;
                }	

                // Then we update appropriately
                staker.unlockedTimestamp = block.timestamp + lockDuration;

                // Use the incoming lock duration if a new stake
                durationToUse = lockDuration;
            } else {
                // Use the remaining lock time as the lock duration if staking again
                // while still within a lock duration
                durationToUse = _getRemainingLockTime(staker);
            }

            staker.owedRewardsLocked += _getStakeRewards(
                durationToUse,
                amount,
                _calcRewardsMultiplier(durationToUse),
                true
            );

            staker.lastTimestampLocked = block.timestamp;
            staker.amountStakedLocked += amount;
        }
    }

    /**
     * @dev Core claim functionality used by both StakingERC20 and StakingERC721
     * @param staker The staker to claim rewards for
     */
    function _coreClaim(Staker storage staker) internal {
        uint256 rewards = _getPendingRewards(staker);

        staker.owedRewards = 0;
        staker.lastTimestamp = block.timestamp;

        if (staker.unlockedTimestamp != 0 && _getRemainingLockTime(staker) == 0) {
            // If the above is true, the rewards will have already been accounted for in
            // the first `_getPendingRewards` call
            // We only need to update here
            staker.owedRewardsLocked = 0;
            staker.lastTimestampLocked = block.timestamp;
        }

        if (rewards == 0) revert ZeroRewards();

        _transferAmount(rewardsToken, rewards);

        emit Claimed(msg.sender, rewards);
    }

    /**
     * @dev Transfer funds to a recipient after deciding whether to use
     * native or ERC20 tokens
     *
     * We give `token` as an argument here because in ERC721 it is always the
     * reward token to transfer, but in ERC20 it could be either staking or rewards
     * token and we won't know which to check.
     */
    function _transferAmount(address token, uint256 amount) internal {
        if (token == address(0)) {
            if (address(this).balance < amount) revert InsufficientContractBalance();

            (bool success, ) = payable(msg.sender).call{value: amount}("");
            if (!success) revert GasTokenTransferFailed();
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }

    /**
     * @dev Calculate the time remaining for a staker's lock. Return 0 if no locked funds or if passed lock time
     * @param staker The staker to get the lock time for
     */
    function _getRemainingLockTime(Staker storage staker) internal view returns(uint256) {
        if (staker.amountStakedLocked == 0 || staker.unlockedTimestamp < block.timestamp) return 0;

        return staker.unlockedTimestamp - block.timestamp;
    }

    /**
     * @dev When `locked` is true, `timeOrDuration` is the lock period
     * @dev When `locked` is false, `timeOrDuration` is the timestamp of the last action
     */
    function _getStakeRewards(
        uint256 timeOrDuration,
        uint256 amount,
        uint256 rewardsMultiplier,
        bool locked
    ) internal view returns (uint256) {
        // Always pre calculate locked rewards when the user stakes, so always use the current config
        if (locked) {
            RewardConfig memory _config = _getLatestConfig();

            return
                rewardsMultiplier * amount * _config.rewardsPerPeriod * timeOrDuration
                / _config.periodLength / LOCKED_PRECISION_DIVISOR;
        }

        uint256 rewards;

        // We store as memory variable to be able to write to it
        uint256 duration = block.timestamp - timeOrDuration; // timestamp, as `locked` is false
        uint256 lastTimestamp = block.timestamp;

        // We do `- 1` in indexing to avoid not looping if only one config
        uint256 i = rewardConfigTimestamps.length;

        for (i; i > 0;) {
            RewardConfig memory _config = rewardConfigs[rewardConfigTimestamps[i - 1]];

            if (_config.timestamp > timeOrDuration) {
                // Use only the applicable length of time for this config, not entore duration
                uint256 effectiveDuration = lastTimestamp - _config.timestamp;
                lastTimestamp = _config.timestamp; // Store for next iteration if needed
                duration -= effectiveDuration;

                rewards += amount * _config.rewardsPerPeriod * effectiveDuration
                    / _config.periodLength / PRECISION_DIVISOR;
            } else {
                rewards += amount * _config.rewardsPerPeriod * duration
                    / _config.periodLength / PRECISION_DIVISOR;
                return rewards;
            }

            unchecked {
                --i;
            }
        }
        return rewards;
    }

    /**
     * @dev Get the total rewards owed to a staker
     * @param staker The staker to get rewards for
     */
    function _getPendingRewards(Staker storage staker) internal view returns (uint256) {
        // Get rewards from non-locked funds already accrued and also between the last timestamp and now
        uint256 rewards;
        if (staker.amountStaked != 0) {
            rewards = staker.owedRewards + _getStakeRewards(
                staker.lastTimestamp,
                staker.amountStaked,
                1, // Rewards multiplier is 1 for non-locked funds
                false
            );
        }

        if (staker.unlockedTimestamp != 0 && _getRemainingLockTime(staker) == 0) {
            // We add the precalculated value of locked rewards to the `staker.owedRewardsLocked`
            // sum on stake, so dont add here again, would be double counting

            uint256 calcRewards = _getStakeRewards(
                _mostRecentTimestamp(staker),
                staker.amountStakedLocked,
                1, // Rewards multiplier is 1 for non-locked funds
                false
            );

            rewards += staker.owedRewardsLocked + calcRewards;
        }

        return rewards;
    }

    /**
     * @dev Get the most recent timestamp for a staker
     * @param staker The staker to get the most recent timestamp for
     */
    function _mostRecentTimestamp(Staker storage staker) internal view returns (uint256) {
        // For calculations of interim time, the time between a user's `unlockedTimestamp` and the present,
        // we have to check if their `lastTimestampLocked` is more recent first.
        // This is because they would be able to double count rewards if they had locked funds
        // and we only compare rewards against their `unlockedTimestamp`, as they could have
        // changed the `lastTimestampLocked` value to get more rewards
        return staker.lastTimestampLocked > staker.unlockedTimestamp
            ? staker.lastTimestampLocked
            : staker.unlockedTimestamp;
    }

    /**
     * @dev Locked rewards receive a multiplier based on the length of the lock
     * @dev Because we precalc when user is staking, getting the latest config is okay
     *
     * @param lock The length of the lock in seconds
     */
    function _calcRewardsMultiplier(uint256 lock) internal view returns (uint256) {
        RewardConfig memory _config = _getLatestConfig();

        return _config.minimumRewardsMultiplier
        + (_config.maximumRewardsMultiplier - _config.minimumRewardsMultiplier)
        * (lock)
        / _config.periodLength;
    }

    /**
     * @dev Get the rewards balance of this contract
     */
    function _getContractRewardsBalance() internal view virtual returns (uint256) {
        if (rewardsToken == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(rewardsToken).balanceOf(address(this));
        }
    }

    function _getLatestConfig() internal view returns (RewardConfig memory) {
        return rewardConfigs[rewardConfigTimestamps[rewardConfigTimestamps.length - 1]];
    }
}
