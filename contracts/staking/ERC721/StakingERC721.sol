// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";
import { StakingBase } from "../StakingBase.sol";
import { IERC721MintableBurnableURIStorage } from "../../types/IERC721MintableBurnableURIStorage.sol";


/**
 * @title Staking721
 * @notice A staking contract that allows depositing ERC721 tokens and mints a
 * non-transferable ERC721 token in return as representation of the deposit.
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingERC721 is StakingBase, IStakingERC721 {
    using SafeERC20 for IERC20;

    /**
     * @notice Mapping that includes ERC721 specific data for each staker
     */
    mapping(address staker => NFTStaker nftStaker) public nftStakers;

    /**
     * @notice Revert if a call is not from the SNFT owner
     */
    modifier onlySNFTOwner(uint256 tokenId) {
        if (IERC721(config.stakeRepToken).ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner();
        }
        _;
    }

    constructor(
        Config memory config
    )
        StakingBase(config)
    {
        if (config.stakingToken.code.length == 0) {
            revert InitializedWithZero();
        }

    }

    /**
     * @notice Stake one or more ERC721 tokens with a lock period
     * @dev These functions are separate intentionally for the sake of user clarity
     *
     * @param tokenIds The id(s) of the tokens to stake
     * @param tokenUris The associated metadata URIs of the tokens to stake
     * @param lockDuration The lock durations, in seconds, for each token
     */
    function stakeWithLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris,
        uint256 lockDuration
    ) external override {
        if (lockDuration < config.minimumLockTime) {
            revert LockTimeTooShort();
        }
        _stake(tokenIds, tokenUris, lockDuration);
    }

    /**
     * @notice Stake one or more ERC721 tokens without a lock period
     * @dev These functions are separate intentionally for the sake of user clarity
     *
     * @param tokenIds Array of tokenIds to be staked by the caller
     * @param tokenUris (optional) Array of token URIs to be associated with the staked tokens. 0s if baseURI is used!
     */
    function stakeWithoutLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris
    ) external override {
        _stake(tokenIds, tokenUris, 0);
    }

    /**
     * @notice Claim rewards for the calling user based on their staked amount
     */
    function claim() public override {
        NFTStaker storage nftStaker = nftStakers[msg.sender];

        _coreClaim(nftStaker.stake);
    }

    /**
     * @notice Unstake all the tokens staked by a user.
     * @dev If a user is still within their lock this will revert
     * @dev OPTIMIZATION: make unstake flow more manageable by separating functionality
     */
    function unstakeAll() public override {
        NFTStaker storage nftStaker = nftStakers[msg.sender];

        _unstake(nftStaker.tokenIdsLocked, true);
        _unstake(nftStaker.tokenIds, false);
    }

    /**
     * @notice Unstake tokens that were not locked
     * @dev Will revert if the incoming array contains tokens that were locked
     * @dev OPTIMIZATION: make unstake flow more manageable by separating functionality
     * 
     * @param _tokenIds Array of tokens to unstake
     */
    function unstakeUnlocked(uint256[] memory _tokenIds) public override {
        _unstake(_tokenIds, false);
    }


    /**
     * @notice Unstake tokens that were locked and are now passed their lock period
     * @dev Will revert if the incoming array contains tokens that were never locked
     * @dev OPTIMIZATION: make unstake flow more manageable by separating functionality
     * 
     * @param _tokenIds Array of tokens to unstake
     */
    function unstakeLocked(uint256[] memory _tokenIds) public override {
        _unstake(_tokenIds, true);
    }

    /**
     * @notice Withdraw locked or unlocked staked funds receiving no rewards 
     * @dev OPTIMIZATION: make unstake flow more manageable by separating functionality
     * 
     * @param locked Indicates whether to withdraw locked or non-locked funds
     */
    function exit(bool locked) public override {
        _exit(locked);
    }

    /**
     * @notice Withdraw all staked funds receiving no rewards
     * @dev OPTIMIZATION: make unstake flow more manageable by separating functionality
     */
    function exitAll() public {
        _exit(true);
        _exit(false);
    }

    /**
     * @notice Get the array of staked tokenIds for the caller
     * @return Array of tokenIds that the caller has staked
     */
    function getStakedTokenIds() public view override returns(uint256[] memory) {
        return nftStakers[msg.sender].tokenIds;
    }

    /**
     * @notice Return the time in seconds remaining for the staker's lock duration
     */
    function getRemainingLockTime() public view override returns (uint256) {
        return _getRemainingLockTime(nftStakers[msg.sender].stake);
    }

    /**
     * @notice Get the total pending rewards for the caller
     * @return The amount of rewards the caller has pending
     */
    function getPendingRewards() public view override returns (uint256) {
        return _getPendingRewards(nftStakers[msg.sender].stake);
    }

    /**
     * @notice Check if a tokenID is locked
     */
    function isLocked(address staker, uint256 tokenId) public view override returns (bool) {
        return nftStakers[staker].locked[tokenId];
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) public pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    ////////////////////////////////////
    /* Internal Functions */
    ////////////////////////////////////

    /**
     * @dev The ERC721 specific stake function, called by both `stakeWithLock` and `stakeWithoutLock`
     * @param tokenIds Array of tokenIds to be staked by the caller
     * @param tokenUris Array of token URIs to be associated with the staked tokens
     * @param lockDuration The lock duration for the staked tokens
     */
    function _stake(uint256[] calldata tokenIds, string[] calldata tokenUris, uint256 lockDuration) internal {
        if (tokenIds.length == 0) {
            revert ZeroValue();
        }

        NFTStaker storage nftStaker = nftStakers[msg.sender];

        _coreStake(nftStaker.stake, tokenIds.length, lockDuration);

        uint256 i;
        for(i; i < tokenIds.length;) {
            // Transfer their NFT to this contract
            IERC721(config.stakingToken).safeTransferFrom(
                msg.sender,
                address(this),
                tokenIds[i]
            );

            // Add to array and to mapping for when unstaking
            if (lockDuration > 0) {
                nftStaker.tokenIdsLocked.push(tokenIds[i]);
                nftStaker.locked[tokenIds[i]] = true;
            } else {
                nftStaker.tokenIds.push(tokenIds[i]);
            }

            // Mint user sNFT
            IERC721MintableBurnableURIStorage(config.stakeRepToken)
                .safeMint(msg.sender, tokenIds[i], tokenUris[i]);

            emit Staked(msg.sender, tokenIds[i]);

            unchecked {
                ++i;
            }
        }
    }

    // OPTIMIZATION: make unstake flow more manageable by separating functionality
    function _unstake(uint256[] memory _tokenIds, bool checkLocked) internal {
        NFTStaker storage nftStaker = nftStakers[msg.sender];

        uint256 owedRewards;
        uint256 stakeBalance;
        uint256 usedTimestamp;

        // Store values we need and reset appropriately
        if (checkLocked) {
            stakeBalance = nftStaker.stake.amountStakedLocked;
            usedTimestamp = _mostRecentTimestamp(nftStaker.stake);
            owedRewards = nftStaker.stake.owedRewardsLocked;
            
            // Will underflow if incoming array is longer than `amountStakedLocked`
            if (_tokenIds.length > nftStaker.stake.amountStakedLocked) {
                revert InvalidUnstake();
            }

            nftStaker.stake.amountStakedLocked -= _tokenIds.length;
            nftStaker.stake.lastTimestampLocked = block.timestamp;
            nftStaker.stake.owedRewardsLocked = 0;
        } else {
            owedRewards = nftStaker.stake.owedRewards;
            stakeBalance = nftStaker.stake.amountStaked;
            usedTimestamp = nftStaker.stake.lastTimestamp;

            // Will underflow if incoming array is longer than `amountStaked`
            if (_tokenIds.length > nftStaker.stake.amountStaked) {
                revert InvalidUnstake();
            }

            nftStaker.stake.amountStaked -= _tokenIds.length;
            nftStaker.stake.lastTimestamp = block.timestamp;
            nftStaker.stake.owedRewards = 0;
        }

        uint256 rewards = owedRewards + _getStakeRewards(
            stakeBalance,
            1, // Rewards multiplier for interim period is 1
            block.timestamp - usedTimestamp,
            false
        );

        uint256 i;
        for (i; i < _tokenIds.length;) {
            bool lockedInState = nftStaker.locked[_tokenIds[i]];
            if (
                checkLocked && !lockedInState
                || !checkLocked && lockedInState
            ) {
                revert InvalidUnstake();
            }

            // function is `onlySNFTOwner` guarded
            _coreUnstake(_tokenIds[i]);
            nftStaker.locked[_tokenIds[i]] = false;

            unchecked {
                ++i;
            }
        }

        if (_getContractRewardsBalance() < rewards) {
            revert InsufficientContractBalance();
        }

        _transferAmount(config.rewardsToken, rewards);

        emit Claimed(msg.sender, rewards);
    }

    // OPTIMIZATION: make unstake flow more manageable by separating functionality
    function _exit(bool locked) internal {
        NFTStaker storage nftStaker = nftStakers[msg.sender];

        uint256 i;

        if (locked) {
            nftStaker.stake.amountStakedLocked = 0;

            for(i; i < nftStaker.tokenIdsLocked.length;) {
                uint256 tokenId = nftStaker.tokenIdsLocked[i];

                _coreUnstake(tokenId);
                nftStaker.locked[tokenId] = false;

                unchecked {
                    ++i;
                }
            }
        } else {
            nftStaker.stake.amountStaked = 0;

            for(i; i < nftStaker.tokenIds.length;) {
                uint256 tokenId = nftStaker.tokenIds[i];

                _coreUnstake(tokenId);
                unchecked {
                    ++i;
                }
            }
        }

        // If no remaining funds at all, delete staker struct for gas savings
        if (nftStaker.stake.amountStaked == 0 && nftStaker.stake.amountStakedLocked == 0) {
            delete nftStakers[msg.sender];
        } else if (locked) {
            // Otherwise reset all values appropriately
            nftStaker.stake.unlockedTimestamp = 0;
            nftStaker.stake.amountStakedLocked = 0;
            nftStaker.stake.owedRewardsLocked = 0;
            nftStaker.stake.lastTimestampLocked = 0;
        } else {
            nftStaker.stake.amountStaked = 0;
            nftStaker.stake.owedRewards = 0;
            nftStaker.stake.lastTimestamp = 0;
        }
    }

    function _coreUnstake(
        uint256 tokenId
    ) internal onlySNFTOwner(tokenId) {
        IERC721MintableBurnableURIStorage(config.stakeRepToken).burn(tokenId);

        // Return NFT to staker
        IERC721(config.stakingToken).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Unstaked(msg.sender, tokenId);
    }
}
