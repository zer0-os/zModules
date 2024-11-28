// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";
import { StakingBase } from "../StakingBase.sol";

// TODO remove when complete
import { console } from "hardhat/console.sol";


/**
 * @title Staking721
 * @notice A staking contract that allows depositing ERC721 tokens and mints a
 * non-transferable ERC721 token in return as representation of the deposit.
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingERC721 is ERC721URIStorage, StakingBase, IStakingERC721 {
    using SafeERC20 for IERC20;

    /**
     * @notice Base URI used for ALL tokens. Can be empty if individual URIs are set.
     */
    string internal baseURI;

    /**
     * @notice Total supply of all tokens
     */
    uint256 internal _totalSupply;

    /**
     * @notice Revert if a call is not from the SNFT owner
     */
    modifier onlySNFTOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner();
        }
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        string memory baseUri,
        IERC721 _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        uint256 _periodLength,
        uint256 _lockAdjustment,
        address _contractOwner
    )
        ERC721(name, symbol)
        StakingBase(
            address(_stakingToken),
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
            _lockAdjustment,
            _contractOwner
        )
    {
        if (bytes(baseUri).length > 0) {
            baseURI = baseUri;
        }
    }

    /**
     * @notice Stake one or more ERC721 tokens with a lock period
     * @dev These are two separate functions intentionally for the sake of user clarity
     * 
     * @param tokenIds The id(s) of the tokens to stake
     * @param tokenUris The associated metadata URIs of the tokens to stake
     * @param lockPeriods The lock durations, in seconds, for each token
     */
    function stakeWithLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris,
        uint256[] calldata lockPeriods // TODO maybe not an array, lock period is per user
    ) external override {
        uint256 i;
        for (i; i < tokenIds.length;) {
            _stake(tokenIds[i], tokenUris[i], lockPeriods[i]);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Stake one or more ERC721 tokens without a lock period
     * @dev These are two separate functions intentionally for the sake of user clarity
     * 
     * @param tokenIds Array of tokenIds to be staked by the caller
     * @param tokenUris (optional) Array of token URIs to be associated with the staked tokens. 0s if baseURI is used!
     */
    function stakeWithoutLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris
    ) external override {
        uint256 i;
        for (i; i < tokenIds.length;) {
            _stake(tokenIds[i], tokenUris[i], 0);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Claim rewards for the calling user based on their staked amount
     */
    function claimUnlockedRewards() external { // override {
        _baseClaim(stakers[msg.sender], false);
    }

    function claimLockedReward() external { // override
        _baseClaim(stakers[msg.sender], true);
    }

    // transfer both?
    function claim() external { // override
        // TODO make simpler, only do one transfer if possible
        // these revert if no rewards, but in double case
        // like below we should only revert if both have no rewards, not just one
        // _baseClaim(stakers[msg.sender], false);
        // _baseClaim(stakers[msg.sender], true);
    }


    /**
     * @notice Unstake one or more specific ERC721 tokens
     * @param tokenIds Array of tokenIds to be unstaked by the caller
     */
    function unstake(
        uint256[] memory tokenIds,
        bool exit
    ) external override {
        _unstakeMany(tokenIds, exit);
    }

    /**
     * @notice Unstake all the tokens staked by a user unless they are locked and `exit` is false
     * 
     * @dev If the caller does not own the sNFT for a stake it will fail.
     * @param exit Flag for unstaking a token regardless of if it is unlocked or not. 
     * if a token is not unlocked but `exit` is true, it will be unstaked without reward
     */
    function unstakeAll(bool exit) public {
        // give list of users entire staked tokenIds
        // TODO how to to this best? right now the typing doesnt match
        // `NFTStake[]` vs. `uint256[]`
    }

    ////////////////////////////////////
    /* Token Functions */
    ////////////////////////////////////

    function setBaseURI(string memory baseUri) external override onlyOwner {
        baseURI = baseUri;
        emit BaseURIUpdated(baseUri);
    }

    function setTokenURI(
        uint256 tokenId,
        string memory tokenUri
    ) external virtual override onlyOwner {
        _setTokenURI(tokenId, tokenUri);
    }

    function getInterfaceId() external pure override returns (bytes4) {
        return type(IStakingERC721).interfaceId;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return
            interfaceId == type(IStakingERC721).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function getStakedTokenIds() public view override returns(NFTStake[] memory) {
        // Staked ERC721 tokenIds
        return stakers[msg.sender].tokenIds;
    }

    ////////////////////////////////////
    /* Internal Staking Functions */
    ////////////////////////////////////

    function _stake(uint256 tokenId, string memory tokenUri, uint256 lockDuration) internal {
        Staker storage staker = stakers[msg.sender];

        //TODO make sure follow up stakes adjust lock duration properly

        if (lockDuration == 0) {
            // not locking
            staker.owedRewards += _getPendingRewards(staker, false); // will be 0 on first stake
            staker.lastTimestamp = block.timestamp;
            ++staker.amountStaked;
        } else {
            // locking
            if (staker.unlockedTimestamp == 0) {
                // first time locking
                staker.lockDuration = lockDuration;
                staker.unlockedTimestamp = block.timestamp + lockDuration;
                staker.rewardsMultiplier = _calcRewardsMultiplier(lockDuration);
            } else {
                // subsequent time staking with lock
                if (staker.lastTimestampLocked != block.timestamp) {
                    // If already called in this loop, it will have updated lastTimestampLocked
                    // For ERC721 tokens that are in the same "group" are still separate stakes
                    // but we don't want those to add to the lock period
                    // should only adjust once per tx
                    staker.unlockedTimestamp += lockAdjustment;

                    // Must update before we update `lastTimestampLocked`
                    staker.owedRewardsLocked += _getPendingRewards(staker, true);
                    staker.lastTimestampLocked = block.timestamp;
                }
            }

            ++staker.amountStakedLocked;
        }

        // Transfer their NFT to this contract
        IERC721(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        NFTStake memory stake = NFTStake(tokenId, lockDuration > 0);

        // Add to array and to mapping for indexing in unstake
        staker.tokenIds.push(stake);
        staker.stakeData[tokenId] = stake;

        // Mint user sNFT (TODO mint ERC721Voter when ready)
        _safeMint(msg.sender, tokenId, tokenUri);

        emit Staked(msg.sender, tokenId, stakingToken);
    }

    // TODO should user be able to claim rewards from locked vs unlocked independently?

    function _baseClaim(Staker storage staker, bool locked) internal {
        // TODO if they exit and we don't mark it properly somehow this could be exploited because they can
        // call to claim without actually being the owner?

        // TODO move outside baseclaim to match unstake
        // TODO rewards would just calc to 0 if same timestamp, which fails downstream
        // if (staker.lastTimestamp == block.timestamp || staker.lastTimestampLocked == block.timestamp) {
        //     revert CannotClaim();
        // }
        uint256 rewards;

        if (locked) {
            if (_getRemainingLockTime(staker) > 0) {
                revert TimeLockNotPassed();
            }
            rewards = _getPendingRewards(staker, true);
            staker.lastTimestampLocked = block.timestamp;
        } else {
            rewards = _getPendingRewards(staker, false);
            staker.lastTimestamp = block.timestamp;
        }

        if (_getContractRewardsBalance() < rewards) {
            revert NoRewardsLeftInContract();
        }

        if (rewards == 0) {
            revert ZeroRewards();
        }

        rewardsToken.safeTransfer(msg.sender, rewards);

        emit Claimed(msg.sender, rewards, address(rewardsToken));
    }

    // TODO maybe have to have two more internals?
    // unstakeUINT256
    // unstakeNFTStakes

    function _unstakeMany(uint256[] memory _tokenIds, bool exit) internal {
        Staker storage staker = stakers[msg.sender];

        bool isAction = false;

        console.log("staker.amountStaked: %s", staker.amountStaked);
        console.log("staker.amountStakedLocked: %s", staker.amountStakedLocked);

        uint256 i = 0;
        for(i; i < _tokenIds.length;) {
            // If the token is unlocked, claim and unstake
            // console.log("i: %s", i);
            if (ownerOf(_tokenIds[i]) == address(0) || ownerOf(_tokenIds[i]) != msg.sender) {
                // Either the list of tokenIds contains a non-existent token
                // or it contains a token the owner doesnt own
                console.log("here2");

                unchecked {
                    ++i;
                }
                continue;
            }
            // console.log("tokenId: %s", tokenId);

            NFTStake memory stake = staker.stakeData[_tokenIds[i]];
            // console.log("on unstaking check: %s", stake.tokenId);
            // console.log("on unstaking check: %s", stake.locked);

            if (stake.locked) {
                if (exit) {
                    // unstake with no rewards
                    console.log("call with exit");
                    _unstake(stake.tokenId);
                    --staker.amountStakedLocked;
                    isAction = true;
                } else if (_getRemainingLockTime(staker) == 0) {
                    console.log("call without exit");

                    // we enforce the lock duration on the user
                    if (staker.lastTimestampLocked != block.timestamp) {
                        // console.log("lastTimestampLocked: %s", staker.lastTimestampLocked);
                        // console.log("block.timestamp: %s", block.timestamp);

                        // If already called in this loop, it will have updated lastTimestampLocked
                        // console.log("claiming locked...");
                        _baseClaim(staker, true);
                    }
                    _unstake(stake.tokenId);
                    // console.log("outside _baseClaim");
                    // console.log("staker.amountStakedLocked: %s", staker.amountStakedLocked);
                    --staker.amountStakedLocked;
                    isAction = true;
                } else {
                    console.log("here3");
                    // stake is locked and cannot be unstaked
                    // loop infinitely if we don't increment 'i' here
                    unchecked {
                        ++i;
                    }
                    continue;
                }
            } else {
                // stake was never locked
                if (staker.lastTimestamp != block.timestamp) {
                    // If already called in this loop, it will have updated lastTimestamp
                    // don't call again
                    // console.log("claiming unlocked...");
                    _baseClaim(staker, false);
                }
                // console.log("unstaked tokenId: %s", stake.tokenId);
                _unstake(stake.tokenId);
                --staker.amountStaked;
                isAction = true;
            }

            unchecked {
                ++i;
            }
        }

        // If no action is taken, revert
        if (!isAction) {
            revert InvalidUnstake();
        }

        // If call was a complete exit, delete the staker struct for this user as well
        if (staker.amountStaked == 0 && staker.amountStakedLocked == 0) {
            // console.log("deleting staker struct");
            delete stakers[msg.sender];
        }
    }

    function _unstake(
        uint256 tokenId
    ) internal onlySNFTOwner(tokenId) {
        _burn(tokenId);
        --_totalSupply;

        // Return NFT to staker
        IERC721(stakingToken).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Unstaked(msg.sender, tokenId, stakingToken);
    }

    function _safeMint(
        address to,
        uint256 tokenId,
        string memory tokenUri
    ) internal {
        ++_totalSupply;
        super._safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function _mint(
        address to,
        uint256 tokenId,
        string memory tokenUri
    ) internal {
        ++_totalSupply;
        super._mint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    /**
     * @dev Disallow all transfers, only `_mint` and `_burn` are allowed
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            revert NonTransferrableToken();
        }

        return super._update(to, tokenId, auth);
    }
}
