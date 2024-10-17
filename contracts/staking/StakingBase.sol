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


    // /**
    //  * @dev Revert if a call is not from the SNFT owner
    //  */
    // modifier onlySNFTOwner(uint256 tokenId) {
    //     if (ownerOf(tokenId) != msg.sender) {
    //         revert InvalidOwner();
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
    }

    /**
     * @notice Claim rewards for the calling user based on their staked amount
     */
    function claimAll() external override {
        // because we access the array of tokenIds by msg.sender, we know ownership
        // we don't have to check because we will only ever  iterate over domains the user has
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
        Staker storage staker = stakers[msg.sender];

        // TODO Staked timestamp is 0 if the user has not staked this token
        // return 0? return maxUint256?
        uint256 stakedTimestamp = staker.stakedTimestamps[tokenId];
        uint256 lockDuration = staker.lockDurations[tokenId];

        if (block.timestamp < stakedTimestamp + lockDuration) {
            return stakedTimestamp + lockDuration - block.timestamp;
        }

        return 0;
    }

    // TODO add a "hasStaked" view function to check if they have staked a token?
    // view functions don't themselves cost gas but if used in a different tx it will
    // this function would still provide utility on front end I think

    /**
     * @notice View the pending rewards balance for a user and a given tokenId
     * 
     * @param tokenId The token ID of the staked token
     */
    function getPendingRewards(uint256 tokenId) external view override returns (uint256) {
        return _getPendingRewards(tokenId);
    }

    function getAllPendingRewards() external view override returns (uint256) {
        uint256 i;
        uint256 rewards;

        // TODO dont need amountStaked, just use tokenIds.length
        Staker storage staker = stakers[msg.sender];

        for (i; i < staker.tokenIds.length;) {
            rewards += _getPendingRewards(staker.tokenIds[i]);

            unchecked {
                ++i;
            }
        }
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

    function _baseClaim(uint256 tokenId, Staker storage staker) internal {
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

        uint256 rewards = _getPendingRewards(tokenId);

        if (_getContractRewardsBalance() < rewards) {
            revert NoRewardsLeftInContract();
        }

        staker.lastClaimedTimestamps[tokenId] = block.timestamp;

        rewardsToken.safeTransfer(msg.sender, rewards);
        emit Claimed(msg.sender, rewards, address(rewardsToken));
    }

    function _getPendingRewards(
        uint256 tokenId
    ) internal view returns (uint256) {
        Staker storage staker = stakers[msg.sender];

        // console.log("rpp", rewardsPerPeriod);
        // console.log("timeStaked", staker.stakedTimestamps[tokenId]);
        // console.log("block.timestamp", block.timestamp);
        // console.log("periodLength", periodLength);
        // console.log("periods passed", (block.timestamp - staker.stakedTimestamps[tokenId]) / periodLength);

        // console.log("block.timestamp", block.timestamp);
        // console.log("staker.lastClaimedTimestamp / 86400", staker.lastClaimedTimestamps[tokenId] / 86400);

        // If staker has not staked this token, return 0
        if (staker.stakedTimestamps[tokenId] == 0) {
            return 0;
        }

        // On first claim, `lastClaimedTimestamps` for a token will be the same as its stake timestamp
        uint256 timeSinceLastClaim = (block.timestamp - staker.lastClaimedTimestamps[tokenId]);
        // console.log("timeSinceLastClaim", timeSinceLastClaim);

        uint256 lockDuration = staker.lockDurations[tokenId];
        // console.log("lockDuration", lockDuration);

        if (lockDuration == 0) {
            // Linear rewards for those who didn't lock their stake
            return (rewardsPerPeriod * timeSinceLastClaim * MULTIPLIER) / 86400;
        } else {
            // Exponential rewards for those that locked
            // console.log("rewardsPerPeriod", rewardsPerPeriod);
            // console.log("timeSinceLastClaim", timeSinceLastClaim);
            // console.log("rv2: ", rewardsPerPeriod * timeSinceLastClaim**(2) * MULTIPLIER);

            // Rewards are reduced at a per day rate, so we divide by 86400 (s per day)

            // TODO does this need to use lockDuration in the formula?
            // TODO for ERC20 the amount they stake should also be relevant
            return (rewardsPerPeriod * timeSinceLastClaim**(2) * MULTIPLIER) / 86400;
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
    // function _onlyUnlocked(uint256 tokenId) internal view {
    //     // TODO what if msg.sender isnt owner? or token isnt staked?
    //     // does NOT revert, but failure in earlier call to owner check reverts first so doesnt matter
    //     if (stakers[msg.sender].stakedTimestamps[tokenId] + stakers[msg.sender].lockDurations[tokenId] > block.timestamp) {
    //         revert TimeLockNotPassed();
    //     }
    // }
}
