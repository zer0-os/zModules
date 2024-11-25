// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
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
        address _stakingToken,
        IERC20 _rewardsToken,
        uint256 _rewardsPerPeriod,
        address _contractOwner
    )
        ERC721(name, symbol)
        StakingBase(
            _stakingToken,
            _rewardsToken,
            _rewardsPerPeriod,
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
        uint256[] calldata lockPeriods
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
     * @notice Claim rewards for a specific token
     * 
     * @param tokenId The token ID to claim rewards for
     */
    function claim(uint256 tokenId) external onlySNFTOwner(tokenId) {
        // _baseClaim(tokenId, stakers[msg.sender]);
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
            // _baseClaim(staker.tokenIds[i], staker);

            unchecked {
                ++i;
            }
        }
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
        // Pull list of tokenIds from caller internally and just provide empty array
        uint256[] memory temp;
        _unstakeMany(temp, exit);
    }

    /**
     * @notice Return the time in seconds remaining for a stake to be claimed or unstaked
     */
    // function getRemainingLockTime(uint256 tokenId) external view override returns (uint256) {
    //     // Return the time remaining for the stake to be claimed or unstaked
    //     Staker storage staker = stakers[msg.sender];

    //     // TODO Staked timestamp is 0 if the user has not staked this token
    //     // return 0? return maxUint256?
    //     // uint256 stakedTimestamp = staker.stakedTimestamps[tokenId];
    //     // uint256 lockDuration = staker.lockDurations[tokenId];

    //     // if (block.timestamp < stakedTimestamp + lockDuration) {
    //     //     return stakedTimestamp + lockDuration - block.timestamp;
    //     // }

    //     return 0;
    // }


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

    function getStakedTokenIds() public view override returns(uint256[] memory) {
        // Staked ERC721 tokenIds
        return stakers[msg.sender].tokenIds;
    }

    ////////////////////////////////////
    /* Internal Staking Functions */
    ////////////////////////////////////

    function _stake(uint256 tokenId, string memory tokenUri, uint256 lockDuration) internal {
        Staker storage staker = stakers[msg.sender];

        if (lockDuration == 0) {
            // not locking
            staker.owedRewards += _getPendingRewards(staker, false); // will be 0 on first stake
            staker.lastTimestamp = block.timestamp;
            ++staker.amountStaked;
        } else {
            // locking
            if (staker.unlockedTimestamp == 0) {
                // first time locking
                console.log("First time locking");
                console.log("lockDuration", lockDuration);
                staker.lockDuration = lockDuration;
                staker.unlockedTimestamp = block.timestamp + lockDuration;
                staker.rewardsMultiplier = _calcRewardsMultiplier(lockDuration);
            } else {
                // subsequent time locking
                // TODO resolve what to do, for now just simple shift
                staker.unlockedTimestamp = block.timestamp + staker.lockDuration;
            }

            // Must always update before we update `lastTimestampLocked`
            staker.owedRewardsLocked += _getPendingRewards(staker, true);
            staker.lastTimestampLocked = block.timestamp;
            ++staker.amountStakedLocked;
        }

        // Transfer their NFT to this contract
        IERC721(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        staker.tokenIds.push(tokenId);

        // Mint user sNFT (TODO mint ERC721Voter when ready)
        _safeMint(msg.sender, tokenId, tokenUri);

        emit Staked(msg.sender, tokenId, stakingToken);
    }

    // For ERC721
    // function _baseClaim(uint256 tokenId, Staker storage staker) internal {
    //     // only comes from Staker right now, so no need to double check ownership
    //     // TODO if they exit and we don't mark it properly somehow this could be exploited because they can
    //     // call to claim without actually being the owner

    //     // Do not distribute rewards for stakes that are still locked
    //     // TODO move this check outside of baseClaim to match what `unstake` does
    //     if (staker.stakedTimestamps[tokenId] + staker.lockDurations[tokenId] > block.timestamp) {
    //         revert TimeLockNotPassed();
    //     }

    //     // // TODO move outside baseclaim to match unstake
    //     if (staker.lastTimestamp == block.timestamp || staker.lastTimestampLocked == block.timestamp) {
    //         revert CannotClaim();
    //     }
    //     uint256 rewards;

    //     // uint256 rewards = _getPendingRewards(staker);

    //     if (_getContractRewardsBalance() < rewards) {
    //         revert NoRewardsLeftInContract();
    //     }

    //     staker.lastClaimedTimestamps[tokenId] = block.timestamp;

    //     // rewardsToken.safeTransfer(msg.sender, rewards);
    //     emit Claimed(msg.sender, rewards, address(rewardsToken));
    // }

    function _unstakeMany(uint256[] memory _tokenIds, bool exit) internal {
        Staker storage staker = stakers[msg.sender];

        // Use the staker's list of tokenIds if none are given
        uint256[] memory tokenIds = _tokenIds.length > 0 ? _tokenIds : staker.tokenIds;

        uint256 amountBefore = staker.amountStaked;

        uint256 i;
        // for(i; i < tokenIds.length;) {

        //     // If the token is unlocked, claim and unstake
        //     if (_checkUnlocked(staker, tokenIds[i])) {
        //         _baseClaim(tokenIds[i], staker);
        //         _unstake(tokenIds[i]);
        //         --staker.amountStaked;
        //     } else if (exit) {
        //         // if `exit` is true we unstake anyways without reward
        //         _unstake(tokenIds[i]);
        //         --staker.amountStaked;
        //     }

        //     unchecked {
        //         ++i;
        //     }
        // }

        // If the token is not unlocked and user is not exiting, no action is taken
        // This will result in a successfull tx that has no change, so to avoid allowing the user to do this we
        // revert here. This will be read by any systems that tries to call `estimateGas` and fail appropriately
        // ahead of time so the user avoids wasting funds here
        if (staker.amountStaked == amountBefore) {
            revert InvalidUnstake();
        }

        // If call was a complete exit, delete the staker struct for this user as well
        if (staker.amountStaked == 0) {
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
