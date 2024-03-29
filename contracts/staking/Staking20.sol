// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721NonTransferable } from "../tokens/ERC721NonTransferable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Shared things
import { Types } from "./Types.sol";
import { StakingPool } from "./StakingPool.sol";
import { IStaking } from "./IStaking.sol";

contract StakingERC20 is ERC721NonTransferable, StakingPool, IStaking {
    /**
	 * @dev The configuration of this staking pool
	 */
	Types.PoolConfig public config;

    /**
     * @notice Log the timestamp when a user stakes.
     * Additional stakes by the same user do not get new timestamps. This
     * is used to calculate the lock period for rewards. Rewards from previous
     * stakes would differ if grouped with new stakes, so they are snapshotted
     * and logged as rewards owed to the user before adding to their total staked amount
     */

    mapping(address staker => Stake stake) public stakes;

    /**
     * @notice Total amount staked by a user
     */
    mapping(address staker => uint256 amountStaked) public staked; // make a 2 var struct for this instead?, reduce # of maps
    /**
     * @notice Rewards owed to a user. Added to on each additional stake, set to 0 on claim
     */
    mapping(address staker => uint256 pendingRewards) public pendingRewards;

    // mapping(address staker => uint256 lockTime) public lockTimes;



    // TODO keeping this for `removeStake` but an extra mapping for a niche use case seems unneccessary?
    // makes deployment and interaction a bit more costly

    // mapping for stakes might have to exist to properly calc rewards on multiple stakes
    // maybe struct with stakeAmount, stakeTimestamp, stakeNonce

    // mapping(address staker => mapping(uint256 stakeNonce => Stake stake)) public stakes; // TODO st: do we need this? (for multiple stakes)
    mapping(address staker => uint256 currentStakeNonce) public currentStakeNonce; // TODO st: do we need this? (for multiple stakes)

    constructor(
		string memory name,
		string memory symbol,
		Types.PoolConfig memory _config
	) ERC721NonTransferable(name, symbol) { // todo even need snft for this?
        _createPool(_config); // TODO do we need concept of pools anymore??
        config = _config;
	}

    /**
     * @notice Stake an amount of the ERC20 staking token specified
     * @param amount The amount to stake
     */
    function stake(uint256 amount) external {

        Stake memory _stake = stakes[msg.sender];

        if (staked[msg.sender] == 0) {
            stakes[msg.sender].stakeTimestamp = block.timestamp;
        } else {
            uint256 accessTime = _stake.claimTimestamp == 0 ? _stake.stakeTimestamp : _stake.claimTimestamp;

            // We snapshot existing rewards up to the present
            // Future rewards are calculated from here
            pendingRewards[msg.sender] += _calculateRewards(
                block.timestamp - accessTime,
                staked[msg.sender],
                config
            );
            stakes[msg.sender].claimTimestamp = block.timestamp;
        }

        // Update with new stake
        staked[msg.sender] += amount;

        IERC20(config.stakingToken).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        emit Staked(0, amount, 0, config.stakingToken);
    }

    function claim() external {
        uint256 rewards;
        (, rewards) = _claimOrUnstake(false);

        emit Claimed(rewards, config.stakingToken);
    }

    function unstake() external {
        // Stake memory _stake = stakes[msg.sender][stakeNonce];
        uint256 stakeAmount;
        uint256 rewards;

        (stakeAmount, rewards)= _claimOrUnstake(true);

        // but also, do we care about showing the orginal amount in the unstaked event?
        emit Unstaked(0, stakeAmount, 0, rewards, config.stakingToken);
    }

    // could keep track of `stakedAmount` total in mapping
    // but that makes other interactions more expensive for this niche use case
    // is there a case where `removeStake` just removes a single stake?
    function removeStake() external {
        // uint256 currentNonce = currentStakeNonce[msg.sender];

        // uint256 i;
        // uint256 totalStaked;
        // for (i; i < currentNonce;) {
        //     Stake memory _stake = stakes[msg.sender][i];

        //     if (_stake.stakeAmount > 0) {
        //         totalStaked += _stake.stakeAmount;
        //         _stake.stakeAmount = 0;
        //     }
        // }

        // IERC20(config.stakingToken).transfer(
        //     msg.sender,
        //     totalStaked
        // );

        // emit StakeRemoved(0, stakeAmount, 0, rewards, config.stakingToken);
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function viewRewardsInPool() external view returns (uint256) {
        return config.rewardsToken.balanceOf(address(this));
    }

    // param for amount?
    // how do we calc for total amount with multiple stakes?
    // function viewClaimableRewards() external view returns (uint256) {
    //     if (block.timestamp - stakedOrClaimedAt[msg.sender] < config.timeLockPeriod) {
    //         return 0;
    //     }

    //     return _calculateRewards(
    //         block.timestamp - stakedOrClaimedAt[msg.sender],
    //         staked[msg.sender],
    //         config
    //     );
    // }

    // view the total amount of rewards for a user

    // function viewPendingRewardsTotal() external view returns (uint256) {
    // function viewClaimableRewards, viewClaimableRewardsTotal
    // TODO maybe should default to total, singularis option
    // shows pending total, not what is claimable

    function viewPendingRewards() external view returns (uint256) {
        Stake memory _stake = stakes[msg.sender];

        uint256 accessTime = _stake.claimTimestamp == 0 ? _stake.stakeTimestamp : _stake.claimTimestamp;

        return _calculateRewards(
            block.timestamp - accessTime,
            staked[msg.sender],
            config
        ) + pendingRewards[msg.sender];
    }
    function returnTimePassed() external view returns (uint256) {
        return block.timestamp - stakes[msg.sender].stakeTimestamp;
    }
    function viewRemainingLockTime() external view returns (uint256) {
        uint256 timePassed = block.timestamp - stakes[msg.sender].stakeTimestamp;
        if (timePassed > config.timeLockPeriod) {
            return 0;
        }
        return config.timeLockPeriod - timePassed;
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _claimOrUnstake(bool isUnstake) public returns (uint256, uint256) {
        if (staked[msg.sender] == 0) {
            revert InvalidStake();
        }

        Stake memory _stake = stakes[msg.sender];

        if(block.timestamp <= _stake.stakeTimestamp + config.timeLockPeriod) {
            revert InvalidClaim();
        }

        uint256 accessTime = _stake.claimTimestamp == 0 ? _stake.stakeTimestamp : _stake.claimTimestamp;

        // would be 0 on reentrancy
        uint256 rewards = _calculateRewards(
            block.timestamp - accessTime,
            staked[msg.sender],
            config
        ) + pendingRewards[msg.sender];

        uint256 stakeAmount = staked[msg.sender];

        if (isUnstake) {
            // Mark time of unstake and remove user staked amount
            _stake.stakeTimestamp = 0;
            _stake.claimTimestamp = 0;
            staked[msg.sender] = 0;

            // Transfer stake back to user
            IERC20(config.stakingToken).transfer(
                msg.sender,
                stakeAmount
            );
        } else {
            // Mark time of claim
            _stake.claimTimestamp = block.timestamp;
            pendingRewards[msg.sender] = 0;
        }

        // TODO should we check require(!0) rewards first?
        // Transfer rewards to user
        config.rewardsToken.transfer(msg.sender, rewards);

        // Return for event emission
        return (stakeAmount, rewards);
    }
}