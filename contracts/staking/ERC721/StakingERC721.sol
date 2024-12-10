// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";
import { StakingBase } from "../StakingBase.sol";

/* solhint-disable no-console */
// TODO remove when ready
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
     * @notice Mapping that includes ERC721 specific data for each staker
     */
    mapping(address staker => NFTStaker nftStaker) public nftStakers;

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
        address _contractOwner
    )
        ERC721(name, symbol)
        StakingBase(
            address(_stakingToken),
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
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
     * @param lockDuration The lock durations, in seconds, for each token
     */
    function stakeWithLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris,
        uint256 lockDuration
    ) external override {
        _stake(tokenIds, tokenUris, lockDuration);
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
        _stake(tokenIds, tokenUris, 0);
    }

    /**
     * @notice Claim rewards for the calling user based on their staked amount
     */
    function claim() public override {
        uint256 rewards = _claim(nftStakers[msg.sender].data);

        if (rewards == 0) {
            revert ZeroRewards();
        }

        if (_getContractRewardsBalance() < rewards) {
            revert InsufficientContractBalance();
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

    ////////////////////////////////////
    /* Token Functions */
    ////////////////////////////////////

    function setBaseURI(string memory baseUri) public override onlyOwner {
        baseURI = baseUri;
        emit BaseURIUpdated(baseUri);
    }

    function setTokenURI(
        uint256 tokenId,
        string memory tokenUri
    ) public virtual override onlyOwner {
        _setTokenURI(tokenId, tokenUri);
    }

    function getInterfaceId() public pure override returns (bytes4) {
        return type(IStakingERC721).interfaceId;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) public pure override returns (bytes4) {
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
        return _getPendingRewards(nftStakers[msg.sender].data);
    }

    ////////////////////////////////////
    /* Internal Staking Functions */
    ////////////////////////////////////

    function _stake(uint256[] calldata tokenIds, string[] calldata tokenUris, uint256 lockDuration) internal {
        NFTStaker storage nftStaker = nftStakers[msg.sender];

        if (lockDuration == 0) {
            // Not locking_getInterimRewards
            // On first stake `_getTimedRewards` will return 0
            nftStaker.data.owedRewards += _getInterimRewards(
                nftStaker.data,
                block.timestamp - nftStaker.data.lastTimestamp,
                false
            );

            nftStaker.data.lastTimestamp = block.timestamp;
            nftStaker.data.amountStaked += tokenIds.length;
        } else {
            uint256 stakeValue = _getStakeValue(tokenIds.length, lockDuration);
            // console.log("stakeValue: %s", stakeValue);
            nftStaker.data.owedRewardsLocked += stakeValue;

            // We only update a users lock duration when it is greater than the previous
            uint256 incomingUnlockedTimestamp = block.timestamp + lockDuration;

            if (incomingUnlockedTimestamp > nftStaker.data.unlockedTimestamp) {
                // User may have already finished their previous lock period
                // if so, grab interim rewards before update
                if (_getRemainingLockTime(nftStaker.data) == 0) {
                    nftStaker.data.owedRewardsLocked +=
                        _getInterimRewards(nftStaker.data, block.timestamp - nftStaker.data.unlockedTimestamp, true);
                }

                nftStaker.data.unlockedTimestamp = incomingUnlockedTimestamp;
                nftStaker.data.lockDuration = lockDuration; // todo need to set this anymore?
            }

            nftStaker.data.lastTimestampLocked = block.timestamp;
            nftStaker.data.amountStakedLocked += tokenIds.length;
        }

        uint256 i;
        for(i; i < tokenIds.length;) {
            // Transfer their NFT to this contract
            IERC721(stakingToken).safeTransferFrom(
                msg.sender,
                address(this),
                tokenIds[i]
            );

            // Add to array and to mapping for indexing in unstake
            nftStaker.tokenIds.push(tokenIds[i]);
            nftStaker.locked[tokenIds[i]] = lockDuration > 0;

            // Mint user sNFT (TODO mint ERC721Voter when ready)
            _safeMint(msg.sender, tokenIds[i], tokenUris[i]);

            emit Staked(msg.sender, tokenIds[i], stakingToken);

            unchecked {
                ++i;
            }
        }
    }

    function _claim(Staker storage staker) internal returns (uint256) {
        uint256 rewards = _getPendingRewards(staker);
        
        // Update timestamp and owed amount *after* calculation
        staker.owedRewards = 0;
        staker.lastTimestamp = block.timestamp;
        
        // If there is no remaining lock time, the locked rewards will have
        // been accounted for in above call to `_getPendingRewards`
        // only need to adjust timestamp and amount here
        if (_getRemainingLockTime(staker) == 0) {
            staker.owedRewardsLocked = 0;
            staker.lastTimestampLocked = block.timestamp;
        }

        return rewards;
    }

    function _unstakeMany(uint256[] memory _tokenIds, bool exit) internal {
        NFTStaker storage nftStaker = nftStakers[msg.sender];

        // Track if any action is taken, revert if not to avoid sucessful but empty tx
        bool isAction = false;

        // Calculate rewards ahead of balance adjustments, if any
        uint256 rewards = _claim(nftStaker.data);

        uint256 i;
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
                // Token was locked
                // console.log("locked");

                if (exit) {
                    // unstake with no rewards
                    // console.log("call with exit");
                    _unstake(_tokenIds[i]);
                    --nftStaker.data.amountStakedLocked;
                    isAction = true;
                } else if (_getRemainingLockTime(nftStaker.data) == 0) {
                    // only unstake if they are passed their lock time
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

        if (rewards > 0 && _getContractRewardsBalance() < rewards) {
            revert InsufficientContractBalance();
        }

        rewardsToken.safeTransfer(msg.sender, rewards);
        emit Claimed(msg.sender, rewards, address(rewardsToken));

        // If a complete withdrawal, delete the staker struct for this user as well
        if (nftStaker.data.amountStaked == 0 && nftStaker.data.amountStakedLocked == 0) {
            delete nftStakers[msg.sender];
        } else if (nftStaker.data.amountStaked != 0) {
            nftStaker.data.amountStakedLocked = 0;
            nftStaker.data.lastTimestampLocked = 0;
            nftStaker.data.unlockedTimestamp = 0;
            nftStaker.data.lockDuration = 0;
        } else {
            nftStaker.data.amountStaked = 0;
            nftStaker.data.lastTimestamp = 0;
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

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
