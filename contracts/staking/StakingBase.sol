// SPDX-License-Identifier: MIT
// solhint-disable immutable-vars-naming
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingBase } from "./IStakingBase.sol";

import { console } from "hardhat/console.sol";

/**
 * @title StakingBase
 * @notice A set of common elements that are used in any Staking contract
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingBase is Ownable, IStakingBase {
    using SafeERC20 for IERC20;

    /**
     * @notice The multiplier multiplier used in rewards calculations
     */
    uint256 MULTIPLIER = 1e16;

    /**
     * @notice Mapping of each staker to that staker's data in the `Staker` struct
     */
    mapping(address user => Staker staker) public stakers;

    // TODO still want to use this?
    // could do stakers[msg.sender].stakedTimestamps[tokenId]

    // modifier onlyUnlocked(uint256 tokenId) {
    //     if (stakedTimestamps[tokenId] + lockDurations[tokenId] < block.timestamp) {
    //         revert TimeLockNotPassed();
    //     }
    //     _;
    // }




    /**
     * TODO Resolve
     * 
     * Rewards could be done several ways. Two options are
     * 
     * 1) A rewards multiplier is calculated when a user stakes. The value is exponential and 
     * based on their lock duration. e.g. Lock 10 = RM 2, lock 20 = RM 5
     * 
     * 2) Rewards themselves are on an exponential curve. This means if you lock for any amount
     * of time you are on this curve, but your rewards increase at marginally increasing rate
     * so if you stake for 10 then claim you get x, but if you wait until 20 to claim you get 
     * more than 2x.
     * 
     * Effectively these are similar but the difference is in follow up claims or unstakes
     * 
     *    In 1) a second claim regardless of how long would always use the RM for that stake
     * but in 2)
     */

    /**
     * @notice The staking token for this pool
     */
    address public immutable stakingToken;

    /**
     * @notice The rewards token for this pool
     */
    IERC20 public immutable rewardsToken;

    /**
     * @notice The rewards of the pool per period length
     */
    uint256 public immutable rewardsPerPeriod;

    // /**
    //  * @notice The length of a time period
    //  */
    // uint256 public immutable periodLength;

    // /**
    //  * @notice The amount of time required to pass to be able to claim or unstake
    //  */
    // uint256 public immutable timeLockPeriod;

    constructor(
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        // uint256 _periodLength, // TODO also have max # periods? e.g. 365 days
        address _contractOwner
    ) Ownable(_contractOwner) {
        if (
            _stakingToken.code.length == 0 ||
            address(_rewardsToken).code.length == 0 ||
            _rewardsPerPeriod == 0
            // _periodLength == 0
        ) revert InitializedWithZero();

        stakingToken = _stakingToken;
        rewardsToken = _rewardsToken;
        rewardsPerPeriod = _rewardsPerPeriod;
        // periodLength = _periodLength;
        // timeLockPeriod = _timeLockPeriod;
    }

    /**
     * @notice Claim rewards for the calling user based on their staked amount
     */
    function claimAll() external override {
        Staker storage staker = stakers[msg.sender];

        uint256 i;
        for (i; i < staker.tokenIds.length;) {
            // TODO better way? dont want loop in _baseClaim but need Staker in baseClaim
            _baseClaim(staker.tokenIds[i], staker);

            unchecked {
                ++i;
            }
        }

    }

    // TODO only have either claim(tokenId) or claimAll(), it will mess with last updated timestamp otherwise
    // unless we have lastClaimedTimestamp as part of stake data?

    /**
     * @notice Emergency function for the contract owner to withdraw leftover rewards
     * in case of an abandoned contract.
     * @dev Can only be called by the contract owner. Emits a `RewardFundingWithdrawal` event.
     */
    function withdrawLeftoverRewards() external override onlyOwner {
        uint256 balance = rewardsToken.balanceOf(address(this));
        if (balance == 0) revert NoRewardsLeftInContract();

        rewardsToken.safeTransfer(owner(), balance);

        emit LeftoverRewardsWithdrawn(owner(), balance);
    }

    /**
     * @notice Return the time in seconds remaining for a stake to be claimed or unstaked
     */
    function getRemainingLockTime(uint256 tokenId) external view override returns (uint256) {
        // Return the time remaining for the stake to be claimed or unstaked
        // TODO fix
        Staker storage staker = stakers[msg.sender];

        uint256 stakedTimestamp = staker.stakedTimestamps[tokenId];

        // if 0, wrong token or not staked

        // if (block.timestamp > staker.unlockTimestamp) {
        //     return 0;
        // }

        // return staker.unlockTimestamp - block.timestamp;
    }

    /**
     * @notice View the pending rewards balance for a user
     */
    function getPendingRewards(uint256 tokenId) external view override returns (uint256) {
        return _getPendingRewards(tokenId, false);
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance() external view override returns (uint256) {
        return _getContractRewardsBalance();
    }

    function setMultiplier(uint256 _multiplier) public onlyOwner {
        MULTIPLIER = _multiplier;
        // TODO emit MultiplierSet
    }

    function getMultiplier() public view override returns (uint256) {
        return MULTIPLIER;
    }

    // Staker getters
    // ERC721 specific staker getter funcs
    // TODO ERC20 same funcs if we create sNFT the same way

    function getAmountStaked() public view override returns(uint256) {
        return stakers[msg.sender].amountStaked;
    }

    function getStakedTokenIds() public view override returns(uint256[] memory) {
        return stakers[msg.sender].tokenIds;
    }

    function getLockDuration(uint256 tokenId) public view override returns (uint256) {
        return stakers[msg.sender].lockDurations[tokenId];
    }

    function getStakedTimestamp(uint256 tokenId) public view override returns (uint256) {
        return stakers[msg.sender].stakedTimestamps[tokenId];
    }

    function getlastClaimedTimestamp(uint256 tokenId) public view override returns (uint256) {
        return stakers[msg.sender].lastClaimedTimestamps[tokenId];
    }

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    function _checkRewards(Staker storage staker) internal {
        // if (staker.amountStaked > 0) {
        //     // It isn't their first stake, snapshot pending rewards
        //     staker.owedRewards = _getPendingRewards(staker);
        // } else {
        //     // Log the time at which this stake becomes claimable or unstakable
        //     // This is only done once per user
        //     staker.unlockTimestamp = block.timestamp; // + timeLockPeriod;
        // }
    }

    function _baseClaim(uint256 tokenId, Staker storage staker) internal {

        uint256 rewards = 0;

        // only comes from Staker right now, so no need to double check ownership
        // TODO if they exit and we don't mark it properly somehow this could be exploited because they can
        // call to claim without actually being the owner

        // Do not distribute rewards for stakes that are still locked
        // TODO move this check outside of baseClaim to match what `unstake` does
        if (staker.stakedTimestamps[tokenId] + staker.lockDurations[tokenId] > block.timestamp) {
            revert TimeLockNotPassed();
        }

        // TODO consider adding reentrant guard to be more specific
        // TODO move outside baseclaim to match unstake
        if (staker.lastClaimedTimestamps[tokenId] == block.timestamp) {
            revert CannotClaim();
        }

        rewards = _getPendingRewards(tokenId, true);

        console.log("new pending rewards", rewards);

        staker.lastClaimedTimestamps[tokenId] = block.timestamp;

        if (_getContractRewardsBalance() < rewards) {
            revert NoRewardsLeftInContract();
        }

        rewardsToken.safeTransfer(msg.sender, rewards);
        emit Claimed(msg.sender, rewards, address(rewardsToken));
    }

    function _getPendingRewards(
        uint256 tokenId,
        bool isClaim
    ) internal view returns (uint256) {
        Staker storage staker = stakers[msg.sender];
        // Return any existing pending rewards value plus the
        // calculated rewards based on the last updated timestamp
        // TODO figure out for just one stake first

        // seconds in a day * days per year
        uint256 secondsPerYear = 86400 * 365;

        // console.log("rpp", rewardsPerPeriod);
        // console.log("timeStaked", staker.stakedTimestamps[tokenId]);
        // console.log("block.timestamp", block.timestamp);
        // console.log("periodLength", periodLength);
        // console.log("periods passed", (block.timestamp - staker.stakedTimestamps[tokenId]) / periodLength);

        // will be in seconds, divide to be in days
        // On first claim, `lastClaimedTimestamps` for a token will be the same as its stake timestamp
        uint256 timeSinceLastClaim = (block.timestamp - staker.lastClaimedTimestamps[tokenId]) / 86400;
        uint256 lockDuration = staker.lockDurations[tokenId];


        // maybe always calc from start but if lastClaim != start

        // If we are reading pending rewards from the `_baseClaim` flow, we update last claimed timestamp
        // if (isClaim) {
        // TODO figure this out, because cant mark as `view` if modify state
        //     staker.lastClaimedTimestamps[tokenId] = block.timestamp;
        // }

        // TODO make 1e16 scalar an adjustable state variable
        if (lockDuration == 0) {
            // Linear rewards for those who didn't lock their stake
            return rewardsPerPeriod * timeSinceLastClaim * MULTIPLIER;
        } else {
            // Exponential rewards for those that did
            // TODO maybe use this number to create a multiplier we can always use in the future?
            return rewardsPerPeriod * timeSinceLastClaim**(2) * MULTIPLIER;
        }

        // return lengthOfStakeInDays * rewardsPerPeriod^(2 + (lockDurationInSeconds / secondsPerYear));
        // return lockDurationInSeconds * rewardsPerPeriod**2 + 2 * lengthOfStakeInDays;
        // if did not lock, just return rewardsPerPeriod * lengthOfStakeInDays
    }

    function _getContractRewardsBalance() internal view returns (uint256) {
        return rewardsToken.balanceOf(address(this));
    }

    function _checkUnlocked(Staker storage staker, uint256 tokenId) internal view returns (bool) {
        return staker.stakedTimestamps[tokenId] + staker.lockDurations[tokenId] < block.timestamp;
    }
    function _onlyUnlocked(Staker storage staker, uint256 tokenId) internal view {
        if (staker.stakedTimestamps[tokenId] + staker.lockDurations[tokenId] > block.timestamp) {
            revert TimeLockNotPassed();
        }
    }
}
