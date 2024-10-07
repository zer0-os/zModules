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

    // constants [1, 2, 3, 4, 5]
    // uint8[] public immutable MULTIPLIER_RATES;

    // TODO consider joining these mappings into a single struct since they both index
    // from tokenId

    // Mapping to hold what the RM is for each stake
    // TODO solidity math on this, we need to scale it correctly
    mapping(uint256 tokenId => uint256 rewardsMultiplier) public rewardsMultipliers;

    // mapping of when a token was staked
    mapping(uint256 tokenId => uint256 timestamp) public stakedTimestamps;

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
        // uint8[] memory _multiplierRates
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

        // MULTIPLIER_RATES = _multiplierRates;
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
        uint256[] calldata lockPeriods
    ) external {
        // does uint64 make a difference here? padded anyways?
        // Stake with lock period and receive RM > 1 (not sure how value is done yet)
        Staker storage staker = stakers[msg.sender];

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

        staker.amountStaked += tokenIds.length;
        staker.lastUpdatedTimestamp = block.timestamp;
    }

    /**
     * @notice Stake one or more ERC721 tokens and receive non-transferable ERC721 tokens in return
     * @param tokenIds Array of tokenIds to be staked by the caller
     * @param tokenUris (optional) Array of token URIs to be associated with the staked tokens. 0s if baseURI is used!
     */
    /**
     * Stakes with array of locking period params as well, then can call the same flow basically
     * just need to make sure we can handle each uniquely and that the rewards are calculated correctly
     */

    function stakeWithoutLock(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris
    ) external override {
        Staker storage staker = stakers[msg.sender];

        // do we still process rewards when 0 stake lock?
        // if so we neeed to check everu past stake to see if 0 lock time stake exists
        // _checkRewards(staker);

        uint256 i;
        for (i; i < tokenIds.length;) {
            // hardcode 60 for testing only, remove TODO
            _stake(tokenIds[i], tokenUris[i], 60);

            unchecked {
                ++i;
            }
        }

        staker.amountStaked += tokenIds.length;
        staker.lastUpdatedTimestamp = block.timestamp; // we dont need this anymore probably
    }

    /**
     * @notice Unstake one or more of what the user has staked
     * @param tokenIds Array of tokenIds to be unstaked by the caller
     * @param exit Flag for if the user would like to exit without rewards
     */
    function unstake(uint256[] memory tokenIds, bool exit) external override {
        Staker storage staker = stakers[msg.sender];

        if (!exit) _onlyUnlocked(staker.unlockTimestamp);

        uint256 i;
        for (i; i < tokenIds.length; ) {
            _unstake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }

        if (!exit) {
            _baseClaim(staker);
        } else {
            // Snapshot their pending rewards
            staker.owedRewards = _getPendingRewards(staker);
        }

        // if `numStaked < tokenIds.length` it will have already failed above
        // so we don't need to check that here
        staker.amountStaked -= tokenIds.length;

        if (staker.amountStaked == 0) {
            delete stakers[msg.sender];
        } else {
            staker.lastUpdatedTimestamp = block.timestamp;
        }
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

    /////// math

    function calculateF(uint256 x) public pure returns (uint256) {
        // Calculate 5^(x / 365)
        // Save for two decimal places of precision
        uint256 exponent = x * 1e18 / 365; // Scale up for precision

        // uint256 result = Math.pow(5, exponent / 1e18); // Adjust scaling back down
        // so two decimals of precision, 0.16 in this case for input of 60 

        // so this is percent of total
        return (exponent / 1e16);
    }



    function getRewardsMultiplier(uint256 tokenId) public view returns (uint256) {
        // will be 0 for a token that is not staked
        return rewardsMultipliers[tokenId];
    }

    ////////////////////////////////////
    /* Internal Staking Functions */
    ////////////////////////////////////

    // TODO 256 for lock period? only need values [1, 365] days
    // 86400s in a day, CREATE UNLOCK TIMESTAMP from this
    function _stake(uint256 tokenId, string memory tokenUri, uint256 lockPeriod) internal {
        if (lockPeriod == 0) {
          // because tokenId is unique we dont need a specific stakeId
            rewardsMultipliers[tokenId] = 1;
        } else {
            uint256 inSeconds = lockPeriod * 86400;
            uint256 unlockTimestamp = block.timestamp + inSeconds;
            // this number is WHEN they can unlock
            rewardsMultipliers[tokenId];
        }

        // Mark when the token was staked. This is needed for future calculations of RM
        stakedTimestamps[tokenId] = block.timestamp;

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

    function _unstake(uint256 tokenId) internal onlySNFTOwner(tokenId) {
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
