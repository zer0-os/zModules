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
     * @notice Counter for the number of stakes by a user
     */
    mapping(address user => uint256 stakedOrClaimedAt) public stakedOrClaimedAt;

    /**
     * @notice Total amount staked by a user
     */
    mapping(address user => uint256 amountStaked) public staked;

    /**
     * @notice Rewards owed to a user. Added to on each additional stake, set to 0 on claim
     */
    mapping(address user => uint256 pendingRewards) public pendingRewards;

    /**
     * @notice Throw when the caller is not the owner of the given token
     */
    error InvalidStake(string message);

    /**
     * @notice Throw when caller is unable to claim rewards
     */
    error InvalidClaim(string message);

    /**
     * @dev Throw when caller is unable to unstake
     */
    error InvalidUnstake(string message);

    // // Only the owner of the representative stake NFT
    // modifier onlySNFTOwner(uint256 tokenId) {
    //     if (ownerOf(tokenId) != msg.sender) {
    //         revert InvalidClaim("Caller is not the owner of the representative stake token");
    //     }
    //     _;
    // }

    constructor(
		string memory name,
		string memory symbol,
		Types.PoolConfig memory _config
	) ERC721NonTransferable(name, symbol) {
        _createPool(_config); // TODO do we need concept of pools anymore??
        config = _config;
	}

    /**
     * @notice Stake an amount of the ERC20 staking token specified
     * @param amount The amount to stake
     */
    function stake(uint256 amount) external {
        // Accrue rewards from existing stakes
        // This will be zero if they are staking for the first time
        pendingRewards[msg.sender] += _calculateRewards(
            block.timestamp - stakedOrClaimedAt[msg.sender],
            staked[msg.sender],
            config
        );

        // how to do individual lock periods
        // so stake rewards for a stake at A can be claimed
        // at time(A+timeLockPeriod), even if we stake B before timeLockPeriod
        // B would be claimable at (B+timelockPeriod), and total for A+B at 

        /**
         * timeLockPeriod = 10 days
         * accrualPeriod = 5 days
         * stakedAmount = 10
         * 
         * T = 1-2-3-4-5-6-7-8-9-10-11-12-13-14-15-16-17-18-19-20
         * ------A---------|-----------||--|-------------------||-
         * --------------B-----------|-------------|||------------
         * T---------W------------X------O----Y---------Z---------

         * 
         * need claimedOrStakedAt for every instance of a stake, I think
         * view partial rewards?
         * e.g. at C what should we show? D?
         * should 
         */

        // Add to user's staked amount
        staked[msg.sender] += amount;

        // Update time of stake
        stakedOrClaimedAt[msg.sender] = block.timestamp;

        IERC20(config.stakingToken).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Mint user SNFT
        // TODO st: even need a thing like this here? whats the point
        // why mint sNFT? can we just track on claim with msg.sender in mapping?
        // _mint(msg.sender, uint256(keccak256(abi.encodePacked(msg.sender, amount))));

        emit Staked(0, amount, 0, config.stakingToken);
    }

    function claim() external {
        uint256 rewards;
        uint256 stakedAmount;
        (stakedAmount, rewards) = _claimOrUnstake(false);

        emit Claimed(rewards, config.stakingToken);
    }

    function unstake() external {
        uint256 stakeAmount;
        uint256 rewards;
        (stakeAmount, rewards) = _claimOrUnstake(true);

        emit Unstaked(0, stakeAmount, 0, rewards, config.stakingToken);
    }

    function removeStake() external {
        IERC20(config.stakingToken).transfer(
            msg.sender,
            staked[msg.sender]
        );

        // emit Unstaked(0, stakeAmount, 0, rewards, config.stakingToken);
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

    // shows pending total, not what is claimable
    function viewPendingRewards() external view returns (uint256) {
        return _calculateRewards(
            block.timestamp - stakedOrClaimedAt[msg.sender],
            staked[msg.sender],
            config
        ) + pendingRewards[msg.sender];
    }

    function viewRemainingLockTime() external view returns (uint256) {
        return config.timeLockPeriod - (block.timestamp - stakedOrClaimedAt[msg.sender]);
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _claimOrUnstake(bool isUnstake) public returns (uint256, uint256) {
        require(
            staked[msg.sender] > 0,
            "Staking20: Cannot claim or unstake"
        );

        uint256 rewards = _calculateRewards(
            block.timestamp - stakedOrClaimedAt[msg.sender],
            staked[msg.sender],
            config
        ) + pendingRewards[msg.sender];

        pendingRewards[msg.sender] = 0;

        uint256 stakedAmount = staked[msg.sender];

        if (isUnstake) {
            // Mark time of unstake and remove user staked amount
            stakedOrClaimedAt[msg.sender] = 0;
            staked[msg.sender] = 0;

            // Transfer stake back to user
            IERC20(config.stakingToken).transfer(
                msg.sender,
                stakedAmount
            );
        } else {
            // Mark time of claim
            stakedOrClaimedAt[msg.sender] = block.timestamp;
        }

        // Transfer rewards to user
        config.rewardsToken.transfer(msg.sender, rewards);

        // Return for event emission
        return (stakedAmount, rewards);
    }
}