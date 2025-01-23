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
     * @notice Unstake one or more specific ERC721 tokens
     * @param tokenIds Array of tokenIds to be unstaked by the caller
     */
    function unstake(
        uint256[] memory tokenIds,
        bool exit
    ) public override {
        _unstakeMany(tokenIds, exit);
    }

    /**
     * @notice Unstake all the tokens staked by a user.
     * @dev If a user is still within their lock time, tokens that are locked are not unstaked
     * unless `exit` is true.
     *
     * @param exit Flag for unstaking a token regardless of if it is unlocked or not.
     * if a token is not unlocked but `exit` is true, it will be unstaked without reward
     */
    function unstakeAll(bool exit) public override {
        _unstakeMany(nftStakers[msg.sender].tokenIds, exit);
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
     * @notice Check if a tokenID is staked
     */
    function isStaked(address staker, uint256 tokenId) public view override returns (bool) {
        return nftStakers[staker].staked[tokenId];
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
        bool locked = lockDuration > 0;
        for(i; i < tokenIds.length;) {
            // Transfer their NFT to this contract
            IERC721(config.stakingToken).safeTransferFrom(
                msg.sender,
                address(this),
                tokenIds[i]
            );

            // Add to array and to mapping for when unstaking
            nftStaker.tokenIds.push(tokenIds[i]);
            nftStaker.staked[tokenIds[i]] = true;
            nftStaker.locked[tokenIds[i]] = locked;

            // Mint user sNFT
            IERC721MintableBurnableURIStorage(config.stakeRepToken)
                .safeMint(msg.sender, tokenIds[i], tokenUris[i]);

            emit Staked(msg.sender, tokenIds[i]);

            unchecked {
                ++i;
            }
        }
    }

    function _unstakeMany(uint256[] memory _tokenIds, bool exit) internal {
        // its possible that token IDs that are already unstaked are passed here
        // because removing them from the users tokenIds[] would be gas expensive
        // and so burning will fail with `non-existent token` error
        // so we check if the token is owned by the user and if not, skip it
        NFTStaker storage nftStaker = nftStakers[msg.sender];

        uint256 rewards;

        // Track if any action is taken, revert if not to avoid sucessful but empty tx
        bool isAction = false;

        // Because of the possibility of having both locked and non-locked tokens
        // unstaked at the same time, we track these values separately
        bool rewardsGiven = false;
        bool rewardsGivenLocked = false;

        uint256 i;
        for (i; i < _tokenIds.length;) {
            if (
                nftStaker.staked[_tokenIds[i]] == false
                || IERC721(config.stakeRepToken).ownerOf(_tokenIds[i]) == address(0)
                || IERC721(config.stakeRepToken).ownerOf(_tokenIds[i]) != msg.sender
            ) {
                // Either the list of tokenIds contains a non-existent token
                // or it contains a token the owner doesnt own
                unchecked {
                    ++i;
                }
                continue;
            }

            // If the token is unlocked, claim and unstake
            if (nftStaker.locked[_tokenIds[i]]) {
                // Token was locked when staked
                // TODO audit: optimize this call that happens twice in the same if!!!
                if (exit || _getRemainingLockTime(nftStaker.stake) == 0) {

                    // we use `<` not `==` because incoming tokens may included non locked
                    // tokens as well so incoming array has to at LEAST be equal
                    if (exit && _tokenIds.length < nftStaker.stake.amountStakedLocked) {
                        revert NotFullExit();
                    }

                    // Get interim locked rewards, if any, at RM of 1
                    if (_getRemainingLockTime(nftStaker.stake) == 0) {
                        uint256 mostRecentTimestamp = _mostRecentTimestamp(nftStaker.stake);
                        // We can't simply give rewards for the entire array's balance because
                        // we can't guarantee every token's lock or non-locked status
                        // So we must do one at a time here
                        rewards += _getStakeRewards(
                            1, // 1 token
                            1, // Rewards multiplier
                            block.timestamp - mostRecentTimestamp,
                            false
                        );

                        if (!rewardsGivenLocked) {
                            rewards += nftStaker.stake.owedRewardsLocked;

                            // can only get this once per tx, not each loop, so set to 0
                            nftStaker.stake.owedRewardsLocked = 0;
                            rewardsGivenLocked = true;
                        }
                    }

                    // In either case, `exit` or `getRemainingLockTime == 0` we unstake
                    // but if we update the user's `amountStakeLocked` before the above it can cause unintentional
                    // rewards overflows
                    // Unstake if they are passed their lock time or exiting
                    _unstake(_tokenIds[i]);
                    --nftStaker.stake.amountStakedLocked;
                    nftStaker.staked[_tokenIds[i]] = false;
                    nftStaker.locked[_tokenIds[i]] = false;
                    isAction = true;
                } else {
                    // stake is locked and cannot be unstaked
                    unchecked {
                        ++i;
                    }
                    continue;
                }
            } else {
                if (!rewardsGiven) {
                    rewards += nftStaker.stake.owedRewards;

                    // set to 0 so they don't get it again in future calls
                    nftStaker.stake.owedRewards = 0;
                    rewardsGiven = true;
                }

                // get interim rewards on a per token basis
                rewards += _getStakeRewards(
                    1, // 1 token
                    1, // Rewards multiplier
                    block.timestamp - nftStaker.stake.lastTimestamp,
                    false
                );

                _unstake(_tokenIds[i]);
                --nftStaker.stake.amountStaked;
                nftStaker.staked[_tokenIds[i]] = false;
                isAction = true;
            }

            unchecked {
                ++i;
            }
        }

        // If no action is taken, revert
        if (!isAction || (!exit && !rewardsGiven && !rewardsGivenLocked)) {
            revert InvalidUnstake();
        }

        if (rewardsGivenLocked) {
            nftStaker.stake.lastTimestampLocked = block.timestamp;
        }

        if (rewardsGiven) {
            // If `isAction` didn't revert above, we know we unstaked
            // at least one non-locked token here
            nftStaker.stake.lastTimestamp = block.timestamp;
        }

        if (!exit) {
            // Transfer the user's rewards
            _transferAmount(config.rewardsToken, rewards);

            emit Claimed(msg.sender, rewards);
        }

        // If a complete withdrawal, delete the staker struct for this user as well
        if (nftStaker.stake.amountStaked == 0 && nftStaker.stake.amountStakedLocked == 0) {
            delete nftStakers[msg.sender];
        } else if (nftStaker.stake.amountStaked != 0 && nftStaker.stake.amountStakedLocked == 0) {
            nftStaker.stake.amountStakedLocked = 0;
            nftStaker.stake.lastTimestampLocked = 0;
            nftStaker.stake.unlockedTimestamp = 0;
        } else if (nftStaker.stake.amountStaked == 0 && nftStaker.stake.amountStakedLocked != 0) {
            nftStaker.stake.amountStaked = 0;
            nftStaker.stake.lastTimestamp = 0;
        }
    }

    function _unstake(
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
