// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingERC20 } from "./IStakingERC20.sol";
import { StakingBase } from "../StakingBase.sol";
import { IERC20MintableBurnable } from "../../types/IERC20MintableBurnable.sol";


/**
 * @title StakingERC20
 * @notice A staking contract for ERC20 tokens
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingERC20 is StakingBase, IStakingERC20 {
    using SafeERC20 for IERC20;

    /**
     * @notice Mapping of each staker to that staker's data in the `Staker` struct
     */
    mapping(address user => Staker staker) public stakers;

    /**
     * @notice Track the total amount staked in the pool
     */
    uint256 public totalStaked;

    constructor(
        address _contractOwner,
        address _stakingToken,
        address _rewardsToken,
        address _stakeRepToken,
        RewardConfig memory _config
    ) StakingBase(
        _contractOwner,
        _stakingToken,
        _rewardsToken,
        _stakeRepToken,
        _config
    ) {}

    /**
     * @notice Stake an amount of ERC20 with a lock period By locking,
     * a user cannot access their funds until the lock period is over, but they
     * receive a higher rewards rate for doing so
     * @dev A user can call to `unstake` with `exit` as true to access their funds
     * before the lock period is over, but they will forfeit their rewards
     * @dev This function and the below `stakeWithoutLock` are intentionally separate for clarity
     *
     * @param amount The amount to stake
     * @param lockDuration The duration of the lock period
     */
    function stakeWithLock(uint256 amount, uint256 lockDuration) external payable override nonReentrant {
        if (lockDuration < _getLatestConfig().minimumLockTime) {
            revert LockTimeTooShort();
        }
        _stake(amount, lockDuration);
    }

    /**
     * @notice Stake an amount of ERC20 with no lock period. By not locking, a
     * user can access their funds any time, but they forfeit a higher rewards rate
     * @dev This function and the above`stakeWithLock` are intentionally separate for clarity
     *
     * @param amount The amount to stake
     */
    function stakeWithoutLock(uint256 amount) external payable override nonReentrant {
        _stake(amount, 0);
    }

    /**
     * @notice Claim all of the user's rewards that are currently available
     */
    function claim() external override nonReentrant {
        // transfer a user their owed rewards + any available pending rewards
        // if funds are locked, only transfer if they are past lock duration
        Staker storage staker = stakers[msg.sender];

        _coreClaim(staker);
    }

    /**
     * @notice Unstake a specified amount of a user's non-locked stake
     *
     * @param amount The amount to withdraw
     */
    function unstakeUnlocked(uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroValue();

        _unstakeUnlocked(amount);
    }

    /**
     * @notice Unstake a specified amount of a user's locked funds that were locked
     * @dev Will revert if funds are still within their lock period
     *
     * @param amount The amount to withdraw
     */
    function unstakeLocked(uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroValue();

        _unstakeLocked(amount);
    }

    function exit(bool locked) external override nonReentrant {
        if (!_getLatestConfig().canExit) revert CannotExit();
        _exit(locked);
    }

    /**
     * @notice Return the time in seconds remaining for the staker's lock duration
     */
    function getRemainingLockTime() public view override returns (uint256) {
        return _getRemainingLockTime(stakers[msg.sender]);
    }

    /**
     * @notice Return the amount of rewards a user is owed
     */
    function getPendingRewards() public view override returns (uint256) {
        return _getPendingRewards(stakers[msg.sender]);
    }

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    function _stake(uint256 amount, uint256 lockDuration) internal {
        if (amount == 0) {
            revert ZeroValue();
        }

        // If stakingToken is gas token, `msg.value` must equal `amount`
        if (stakingToken == address(0)) {
            if (msg.value != amount) {
                revert InsufficientValue();
            }
        } else {
            if (msg.value != 0) {
                revert NonZeroMsgValue();
            }
        }

        Staker storage staker = stakers[msg.sender];

        _coreStake(staker, amount, lockDuration);

        totalStaked += amount;

        // Transfers user's funds to this contract
        if (stakingToken != address(0)) {
            IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), amount);
        } // the `else` case is handled by including `recieve` above to accept `msg.value`

        // Mint the user's stake as a representative token
        IERC20MintableBurnable(stakeRepToken).mint(msg.sender, amount);

        emit Staked(msg.sender, amount, lockDuration);
    }

    function _exit(bool locked) internal {
        Staker storage staker = stakers[msg.sender];

        uint256 amount;

        // Store the necessary `amount` to transfer
        // then modify the variables as needed first
        if (locked) {
            amount = staker.amountStakedLocked;

            staker.amountStakedLocked = 0;
            staker.owedRewardsLocked = 0;
            staker.lastTimestampLocked = 0;
            staker.unlockedTimestamp = 0;
        } else {
            amount = staker.amountStaked;

            staker.amountStaked = 0;
            staker.owedRewards = 0;
            staker.lastTimestamp = 0;
        }

        if (staker.amountStakedLocked == 0 && staker.amountStaked == 0) {
            delete stakers[msg.sender];
        }

        // Burn the user's stake representative token
        IERC20MintableBurnable(stakeRepToken).burn(msg.sender, amount);

        // Return user's stake
        _transferAmount(stakingToken, amount);

        emit Exited(msg.sender, amount, locked);
    }

    function _unstakeUnlocked(uint256 amount) internal {
        Staker storage staker = stakers[msg.sender];

        uint256 amountStaked = staker.amountStaked;
        if (amount > amountStaked) revert UnstakeMoreThanStake();

        uint256 rewards = staker.owedRewards += _getStakeRewards(
            staker.lastTimestamp,
            amountStaked,
            1,
            false
        );

        staker.owedRewards = 0;
        staker.amountStaked -= amount;

        // If removal of all non-locked funds
        if (staker.amountStaked == 0) {
            if (staker.amountStakedLocked == 0) {
                // and there are no locked funds, delete struct
                delete stakers[msg.sender];
            } else {
                // Otherwise set values to 0
                staker.amountStaked = 0;
                staker.lastTimestamp = 0;
            }
        } else {
            // If not full withdrawal, only timestamp needs updating
            staker.lastTimestamp = block.timestamp;
        }

        // Transfer the user's rewards
        // Will fail if the contract does not have funding for this
        // If rewards address is `0x0` we use the chain's native token
        _transferAmount(rewardsToken, rewards);

        emit Claimed(msg.sender, rewards);

        totalStaked -= amount;

        // Burn the user's stake representative token
        IERC20MintableBurnable(stakeRepToken).burn(msg.sender, amount);

        // Return the user's initial stake
        _transferAmount(stakingToken, amount);

        emit Unstaked(msg.sender, amount);
    }

    function _unstakeLocked(uint256 amount) internal {
        Staker storage staker = stakers[msg.sender];

        uint256 amountStakedLocked = staker.amountStakedLocked;
        if (amount > amountStakedLocked) revert UnstakeMoreThanStake();

        if (_getRemainingLockTime(staker) > 0) revert TimeLockNotPassed();

        // If claims happen after lock period has passed, the lastTimestampLocked is more accurate
        // but if they don't happen, then lastTimestampLocked may still be the original stake timestamp
        // and we should use `unlockedTimestamp` instead.
        // so we have to calculate which is more recent before calculating rewards
        uint256 mostRecentTimestamp = _mostRecentTimestamp(staker);

        // We already added the value they are owed in stake when pre calculating
        // now we just add the value they are owed for rewards in between
        uint256 rewards = staker.owedRewardsLocked + _getStakeRewards(
            mostRecentTimestamp,
            amountStakedLocked,
            1,
            false
        );

        // Update to show they have claimed this value
        staker.owedRewardsLocked = 0;
        staker.amountStakedLocked -= amount;

        // If removal of all locked funds
        if (staker.amountStakedLocked == 0) {
            if (staker.amountStaked == 0) {
                // and there are no non-locked funds, delete struct
                delete stakers[msg.sender];
            } else {
                // Otherwise set locked values to 0
                staker.amountStakedLocked = 0;
                staker.lastTimestampLocked = 0;
                staker.unlockedTimestamp = 0;
            }
        } else {
            // If not full withdrawal, only timestamp needs updating
            staker.lastTimestampLocked = block.timestamp;
        }

        // Transfer the user's rewards
        // Will fail if the contract does not have funding for this
        // If rewards address is `0x0` we use the chain's native token
        _transferAmount(rewardsToken, rewards);

        emit Claimed(msg.sender, rewards);

        totalStaked -= amount;

        // Return the user's initial stake
        _transferAmount(stakingToken, amount);

        // Burn the user's stake representative token
        IERC20MintableBurnable(stakeRepToken).burn(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @dev If we just use `rewardsToken.balance` on the contract address when checking
     * funding it will be a misleading amount because it will also include the amount staked by users
     * To avoid this, we override the internal `_getContractRewardsBalance` function to
     * return the balance of the rewards token minus the total staked amount
     */
    function _getContractRewardsBalance() internal view override returns (uint256) {
        uint256 balance = super._getContractRewardsBalance();

        if (rewardsToken == stakingToken) {
            return balance - totalStaked;
        }

        return balance;
    }
}
