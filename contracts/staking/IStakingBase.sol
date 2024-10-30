// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


/**
 * @title IStakingBase
 * @notice Interface for the base staking contract
 */
interface IStakingBase {

    /**
     * @notice Struct to track an individual staker's data
     */
    struct Staker { // Consider breaking into multple structs. Base only should have "CoreStaker"
        // TODO this will be different for ERC20, need different structs?
        // TODO maybe these mappings should be independent state variables?
        // reduce the need for passing the Staker struct around
        // but also having them in this struct means not having to check ownership repeatedly
        // make 2D mappings ? address => tokenId => data
        uint256 amountStaked;
        uint256 amountStakedLocked; // TODO two pools, one for locked one for unlocked

        uint256 rewardsMultiplier; // Set on stake based on duration of given lock

        uint256 owedRewards; // rewards from locked stakes, accessible when lock is finished
        uint256 owedRewardsLocked; // rewards from unlocked stakes, accessible any time

        uint256 lockDuration;
        uint256 unlockedTimestamp; // For ERC20 locks are per user, not per stake

        uint256 lastTimestamp; // For ERC20, last touchpoint claim OR stake
        uint256 lastTimestampLocked; // For ERC20, last touchpoint claim OR stake on locked values

        uint256[] tokenIds; // for indexing when bulk claiming / revoking

        // TODO maybe for ERC20 we can create an sNFT for staker mappings
        // as each stake will have to be unique now, lock is per stake not
        // per user anymore
        mapping(uint256 tokenId => uint256 lockDuration) lockDurations;
        mapping(uint256 tokenId => uint256 stakedTimestamp) stakedTimestamps;
        mapping(uint256 tokenId => uint256 lastClaimedTimestamp) lastClaimedTimestamps;
    }

    // TODO gas implications of having one struct with mappings etc.
    // looks about the same from reading online
    // one mapping and struct vs several 2D mappings
    // one mapping == no ownership checks
    // but 2d mappings have the same thing if they are mapped by address?
    // main difference is number of state variables

    /**
     * @notice Emitted when the contract owner withdraws leftover rewards
     * @param owner The address of the contract owner
     * @param amount The amount of rewards withdrawn
     */
    event LeftoverRewardsWithdrawn(
        address indexed owner,
        uint256 indexed amount
    );

    /**
     * @notice Emit when a user claims rewards
     * @dev Because all contracts reward in ERC20 this can be shared
     * @param claimer The address of the user claiming rewards
     * @param rewards The amount of rewards the user received
     * @param rewardsToken The address of the rewards token contract
     */
    event Claimed(
        address indexed claimer,
        uint256 indexed rewards,
        address indexed rewardsToken
    );

    /**
     * @notice Throw when the lock period has not passed
     */
    error TimeLockNotPassed();

    /**
     * @notice Throw when trying to claim within an invalid period
     * @dev Used to protect against reentrancy
     */
    error CannotClaim();

    /**
     * @notice Throw when trying to claim but user has no rewards
     */
    error ZeroRewards();

    /**
     * @notice Throw when there are no rewards remaining in the pool
     * to give to stakers
     */
    error NoRewardsLeftInContract();

    /**
     * @notice Throw when passing zero values to set a state var
     */
    error InitializedWithZero();

    function claimAll() external;

    function withdrawLeftoverRewards() external;

    function getPendingRewards() external view returns (uint256);

    function getAllPendingRewards() external view returns (uint256);

    function getContractRewardsBalance() external view returns (uint256);

    function setMultiplier(uint256 _multiplier) external;

    function getMultiplier() external view returns (uint256);

    function getAmountStaked() external view returns (uint256);
    
    function getAmountStakedLocked() external view returns (uint256);

    function getStakedTokenIds() external view returns(uint256[] memory);

    function getLockDuration(uint256 tokenId) external view returns (uint256);
    
    function getLockDuration() external view returns (uint256);

    function getStakedTimestamp(uint256 tokenId) external view returns (uint256);
    
    function getLastTimestamp() external view returns (uint256);
    
    function getLastTimestampStaked() external view returns (uint256);

    function getlastClaimedTimestamp(uint256 tokenId) external view returns (uint256);
}
