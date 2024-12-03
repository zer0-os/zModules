// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";
import { StakingBase } from "../StakingBase.sol";
import { AStakingBase } from "../AStakingBase.sol";

// TODO remove when complete
import { console } from "hardhat/console.sol";


/**
 * @title Staking721
 * @notice A staking contract that allows depositing ERC721 tokens and mints a
 * non-transferable ERC721 token in return as representation of the deposit.
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingERC721 is ERC721URIStorage, StakingBase, AStakingBase, IStakingERC721 {
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
     * @notice Mapping that includes ERC721 specific data for each staker
     */
    mapping(address staker => NFTStaker) public nftStakers;

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
    function claim() public override {
        uint256 rewards = 
            _baseClaim(nftStakers[msg.sender].data, false) + 
            _baseClaim(nftStakers[msg.sender].data, true);

        if (rewards == 0) {
            revert ZeroRewards();
        }

        rewardsToken.safeTransfer(msg.sender, rewards);

        emit Claimed(msg.sender, rewards, address(rewardsToken));
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
     * @notice Unstake all the tokens staked by a user.
     * @dev If a user is still within their lock time, tokens that are locked are not unstaked
     * unless `exit` is true.
     * 
     * @param exit Flag for unstaking a token regardless of if it is unlocked or not. 
     * if a token is not unlocked but `exit` is true, it will be unstaked without reward
     */
    function unstakeAll(bool exit) public {
        _unstakeMany(nftStakers[msg.sender].tokenIds, exit);
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

    function getStakedTokenIds() public view override returns(uint256[] memory) {
        // Staked ERC721 tokenIds
        return nftStakers[msg.sender].tokenIds;
    }

    /**
     * @notice Return the time in seconds remaining for the staker's lock duration
     */
    function getRemainingLockTime() public view override returns (uint256) {
        return _getRemainingLockTime(nftStakers[msg.sender].data);
    }

        function getPendingRewards() public view override returns (uint256) {
        return _getPendingRewards(nftStakers[msg.sender].data, false);
    }

    function getPendingRewardsLocked() public view override returns (uint256) {
        return _getPendingRewards(nftStakers[msg.sender].data, true);
    }

    function getTotalPendingRewards() public view override returns (uint256) {
        Staker storage staker = nftStakers[msg.sender].data;
        return staker.owedRewards + staker.owedRewardsLocked + _getPendingRewards(staker, false) + _getPendingRewards(staker, true);
    }

    ////////////////////////////////////
    /* Internal Staking Functions */
    ////////////////////////////////////

    function _stake(uint256 tokenId, string memory tokenUri, uint256 lockDuration) internal {
        NFTStaker storage nftStaker = nftStakers[msg.sender];

        if (lockDuration == 0) {
            // not locking
            nftStaker.data.owedRewards += _getPendingRewards(nftStaker.data, false); // will be 0 on first stake
            nftStaker.data.lastTimestamp = block.timestamp;
            ++nftStaker.data.amountStaked;
        } else {
            // locking
            if (nftStaker.data.unlockedTimestamp == 0) {
                // first time locking
                nftStaker.data.lockDuration = lockDuration;
                nftStaker.data.unlockedTimestamp = block.timestamp + lockDuration;
                nftStaker.data.lastTimestampLocked = block.timestamp;
                nftStaker.data.rewardsMultiplier = _calcRewardsMultiplier(lockDuration);
            } else {
                // subsequent time staking with lock
                if (nftStaker.data.lastTimestampLocked != block.timestamp) {
                    // If already called in this loop, it will have updated lastTimestampLocked
                    // For ERC721 tokens that are in the same "group" are still separate stakes
                    // but we don't want those to add to the lock period
                    // should only adjust once per tx
                    _adjustLock(nftStaker.data);

                    // Must update before we update `lastTimestampLocked`
                    nftStaker.data.owedRewardsLocked += _getPendingRewards(nftStaker.data, true);
                    nftStaker.data.lastTimestampLocked = block.timestamp;
                }
            }

            ++nftStaker.data.amountStakedLocked;
        }

        // Transfer their NFT to this contract
        IERC721(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Add to array and to mapping for indexing in unstake
        nftStaker.tokenIds.push(tokenId);
        nftStaker.locked[tokenId] = lockDuration > 0;

        // Mint user sNFT (TODO mint ERC721Voter when ready)
        _safeMint(msg.sender, tokenId, tokenUri);

        emit Staked(msg.sender, tokenId, stakingToken);
    }

    function _baseClaim(Staker storage staker, bool locked) internal returns (uint256) {
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

        // console.log("rewards: %s", rewards);
        // console.log("getContractBalance: %s", _getContractRewardsBalance());
        if (_getContractRewardsBalance() < rewards) {
            revert NoRewardsLeftInContract();
        }

        return rewards;
    }

    function _unstakeMany(uint256[] memory _tokenIds, bool exit) internal {
        NFTStaker storage nftStaker = nftStakers[msg.sender];

        // Track if any action is taken, revert if not to avoid sucessful but empty tx
        bool isAction = false;

        uint256 i = 0;
        for(i; i < _tokenIds.length;) {
            // console.log("enter loop");
            // If the token is unlocked, claim and unstake
            if (ownerOf(_tokenIds[i]) == address(0) || ownerOf(_tokenIds[i]) != msg.sender) {
                // Either the list of tokenIds contains a non-existent token
                // or it contains a token the owner doesnt own
                unchecked {
                    ++i;
                }
                continue;
            }

            if (nftStaker.locked[_tokenIds[i]]) {
                // console.log("locked");

                if (exit) {
                    // unstake with no rewards
                    // console.log("call with exit");
                    _unstake(_tokenIds[i]);
                    --nftStaker.data.amountStakedLocked;
                    isAction = true;
                } else if (_getRemainingLockTime(nftStaker.data) == 0) {
                    // console.log("call without exit");

                    // we enforce the lock duration on the user
                    if (nftStaker.data.lastTimestampLocked != block.timestamp) {
                        // console.log("lastTimestampLocked: %s", staker.lastTimestampLocked);
                        // console.log("block.timestamp: %s", block.timestamp);

                        // If already called in this loop, it will have updated lastTimestampLocked
                        // console.log("claiming locked...");
                        claim();
                    }
                    _unstake(_tokenIds[i]);
                    --nftStaker.data.amountStakedLocked;
                    isAction = true;
                } else {
                    // stake is locked and cannot be unstaked
                    // console.log("here3");
                    unchecked {
                        ++i;
                    }
                    continue;
                }
            } else {
                // stake was never locked
                // console.log("not locked");
                if (nftStaker.data.lastTimestamp != block.timestamp) {
                    // console.log("call claim");

                    // If already called in this loop, it will have updated lastTimestamp, don't call again
                    claim();
                }
                // console.log("call unstake");
                _unstake(_tokenIds[i]);
                --nftStaker.data.amountStaked;
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

        // console.log("amountStaked: %s", nftStaker.data.amountStaked);
        // console.log("amountStakedLocked: %s", nftStaker.data.amountStakedLocked);

        // If a complete withdrawal, delete the staker struct for this user as well
        if (nftStaker.data.amountStaked == 0 && nftStaker.data.amountStakedLocked == 0) {
            delete nftStakers[msg.sender];
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
