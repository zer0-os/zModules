// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";
import { StakingBase } from "../StakingBase.sol";

// import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Math } from "./Math.sol";


/**
 * @title Staking721
 * @notice A staking contract that allows depositing ERC721 tokens and mints a
 * non-transferable ERC721 token in return as representation of the deposit.
 * @author James Earle <https://github.com/JamesEarle>, Kirill Korchagin <https://github.com/Whytecrowe>
 */
contract StakingERC721 is ERC721URIStorage, StakingBase, IStakingERC721 {
    using Math for uint256;
    /**
     * @notice Base URI used for ALL tokens. Can be empty if individual URIs are set.
     */
    string internal baseURI;

    /**
     * @notice Total supply of all tokens
     */
    uint256 internal _totalSupply;

    

    // stake
    //  set when it was staked
    //  set how long it will be locked

    // claim
    //  set when it was claimed

    // unstake
    //  unset when it was staked
    //  unset how long it will be locked

    // mapping(address user => ERC721Staker) public tokenStakers;
    // TODO consider joining these mappings into a single struct since they both index
    // from tokenId

    // only the owner of a stake holds the sNFT, no need to store owner

    /**
     * @dev Revert if a call is not from the SNFT owner
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
        uint256 _periodLength,
        address _contractOwner
    )
        ERC721(name, symbol)
        StakingBase(
            _stakingToken,
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
     * user stakes without lock with no existing stakes
     * user stakes without lock with existing stakes
     * user stakes with lock with no existing stakes
     * user stakes with lock with existing stakes
     * 
     * stakes have to be uniquely identifiable,. need stakeID or similar in mapping to RM
     * 
     *  user specifies how many days to lock for, we calc future timestamp of when that is
     * then RM is some value based on that, positively correlated so bigger lock == bigger RM
     */

    
    function stakeWithLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris,
        uint256[] calldata lockPeriods // in days or in s? probably easier coming in as days
    ) external {
        // Stake with lock period and receive RM > 1 (not sure how value is done yet)
        // Staker storage staker = stakers[msg.sender];

        // do we still process rewards when 0 stake lock?
        // if so we neeed to check everu past stake to see if 0 lock time stake exists
        // _checkRewards(staker);

        uint256 i;
        for (i; i < tokenIds.length;) {
            _stake(tokenIds[i], tokenUris[i], lockPeriods[i]);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Stake one or more ERC721 tokens and receive non-transferable ERC721 tokens in return
     * @param tokenIds Array of tokenIds to be staked by the caller
     * @param tokenUris (optional) Array of token URIs to be associated with the staked tokens. 0s if baseURI is used!
     */
    function stakeWithoutLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris
    ) external override {
        // TODO do we still process rewards when 0 stake lock?
        // if so we neeed to check every past stake to see if 0 lock time stake exists
        // _checkRewards(staker);

        uint256 i;
        for (i; i < tokenIds.length;) {
            _stake(tokenIds[i], tokenUris[i], 0);

            unchecked {
                ++i;
            }
        }
    }


    /**
     * @notice Unstake one or more specific ERC721 tokens
     * @param tokenIds Array of tokenIds to be unstaked by the caller
     */
    function unstake(uint256[] memory tokenIds) external override {
        // onlySNFTOwner
        // onlyUnlocked

        // Staker storage staker = stakers[msg.sender];

        // // if (!exit) _onlyUnlocked(staker.unlockTimestamp);

        // uint256 i;
        // for (i; i < tokenIds.length;) {
        //     _unstake(tokenIds[i]);

        //     unchecked {
        //         ++i;
        //     }
        // }

        // if (!exit) {
        //     _baseClaim(staker);
        // } else {
        //     // Snapshot their pending rewards
        //     staker.owedRewards = _getPendingRewards(staker);
        // }

        // if `numStaked < tokenIds.length` it will have already failed above
        // so we don't need to check that here
        // staker.amountStaked -= tokenIds.length;

        // if (staker.amountStaked == 0) {
        //     delete stakers[msg.sender];
        // } else {
        // }
    }

    /**
     * @notice Unstake all the staked tokens associated with the calling user
     * @dev Will fail if caller does not own the sNFT created when staking
     * @param exit If exit is `true`, also unstake tokens that are still locked and forego
     * any rewards for them
     */
    function unstakeAll(bool exit) public {
        Staker storage staker = tokenStakers[msg.sender];

        uint256 i;
        for(i; i < staker.tokenIds.length;) {

            uint256 tokenId = staker.tokenIds[i];

            // Should only transfer if token is unlocked
            // If exit is true, we go ahead with unstake regardless of lock or not
            // _baseClaim(tokenId, staker, exit);

            /**
             * if token is unlocked
             *   claim
             *   unstake
             * else
             *   if (exit)
             *     unstake anyways
             * 
             */

            //TODO = block timestamp in places? verify this, could be weird case because we only use
            // > or < in checks throughout these contracts

            // If the token is unlocked, claim and unstake
            if (staker.stakedTimestamps[tokenId] + staker.lockDurations[tokenId] > block.timestamp) {
                _baseClaim(tokenId, staker);
                _unstake(tokenId);
            } else if (exit) { // if not unlocked but `exit` is true, unstake
                _unstake(tokenId);
            }

            unchecked {
                ++i;
            }
        }
    }

    // TODO unstakeAll (that are available) and also unstakeAll with forfeiting some rewards?
    // TODO provide unstakeMany that loops unstake with array of tokenIds


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

    ////////////////////////////////////
    /* Internal Staking Functions */
    ////////////////////////////////////

    function _stake(uint256 tokenId, string memory tokenUri, uint256 lockPeriod) internal {
        Staker storage staker = tokenStakers[msg.sender];

        staker.stakedTimestamps[tokenId] = block.timestamp;
        staker.lastClaimedTimestamps[tokenId] = block.timestamp;
        staker.lockDurations[tokenId] = lockPeriod;
        staker.tokenIds.push(tokenId);
        ++staker.amountStaked;

        // Transfer their NFT to this contract
        IERC721(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Mint user sNFT
        _safeMint(msg.sender, tokenId, tokenUri);

        emit Staked(msg.sender, tokenId, stakingToken);
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
