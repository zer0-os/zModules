// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { StakingBase } from "./StakingBase.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";


/**
 * @title Staking721
 * @notice A staking contract that allows depositing ERC721 tokens and mints a
 * non-transferable ERC721 token in return as representation of the deposit.
 */
contract StakingERC721 is ERC721, ERC721URIStorage, StakingBase, Ownable, IStakingERC721 {
    /**
     * @dev Mapping of each staker to that staker's data in the `Staker` struct
     */
    mapping(address staker => Staker stakerData) public stakers;

    /**
     * @notice Base URI used for ALL tokens (sNFT) representing a stake. Can be empty if individual URIs are set.
     */
    string internal baseURI;

    /**
     * @notice Total supply of all stake tokens (sNFT) issued to stakers.
     */
    uint256 internal _totalSupply;

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
        uint256 _timeLockPeriod
    )
        ERC721(name, symbol)
        StakingBase(
            _stakingToken,
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
            _timeLockPeriod
        )
    {
        if (bytes(baseUri).length > 0) {
            baseURI = baseUri;
        }
    }

    /**
     * @notice Stake one or more ERC721 tokens and receive non-transferable ERC721 tokens in return
     * @param tokenIds Array of tokenIds to be staked by the caller
     * @param tokenUris (optional) Array of token URIs to be associated with the staked tokens. 0s if baseURI is used!
     */
    function stake(
        uint256[] calldata tokenIds,
        string[] calldata tokenUris
    ) external override {
        Staker storage staker = stakers[msg.sender];

        if (staker.numStaked > 0) {
            // It isn't their first stake, snapshot pending rewards
            staker.pendingRewards = _getPendingRewards(staker);
        } else {
            // Log the time at which this stake becomes claimable or unstakable
            // This is only done once per user
            staker.unlockTimestamp = block.timestamp + timeLockPeriod;
        }

        uint256 i;
        for (i; i < tokenIds.length;) {
            _stake(tokenIds[i], tokenUris[i]);

            unchecked {
                ++i;
            }
        }

        staker.numStaked += tokenIds.length;
        staker.lastUpdatedTimestamp = block.timestamp;
    }

    /**
     * @notice Claim rewards for all staked ERC721 tokens
     * @dev Will revert if the time lock period has not been met or if
     * the user has not staked any tokens
     */
    function claim() external override {
        _claim(stakers[msg.sender]);
    }

    /**
     * @notice Unstake one or more ERC721 tokens
     * @param tokenIds Array of tokenIds to be unstaked by the caller
     * @param exit Flag for if the user would like to exit without rewards
     */
    function unstake(uint256[] memory tokenIds, bool exit) external override {
        Staker storage staker = stakers[msg.sender];

        if (!exit) _onlyUnlocked(staker.unlockTimestamp);

        uint256 i;
        for (i; i < tokenIds.length;) {
            _unstake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }

        if (!exit) {
            _claim(staker);
        }

        // if `numStaked < tokenIds.length` it will have already failed above
        // so we don't need to check that here
        staker.numStaked -= tokenIds.length;

        if (staker.numStaked == 0) {
            delete stakers[msg.sender];
        } else {
            staker.lastUpdatedTimestamp = block.timestamp;
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

        rewardsToken.transfer(owner(), balance);

        emit RewardLeftoverWithdrawal(owner(), balance);
    }

    /**
     * @notice View the rewards balance in this pool
     */
    function getContractRewardsBalance() external view override returns (uint256) {
        return _getContractRewardsBalance();
    }

    /**
     * @notice View the pending rewards balance for a user
     */
    function getPendingRewards() external view override returns (uint256) {
        return _getPendingRewards(stakers[msg.sender]);
    }

    /**
     * @notice Return the time, in seconds, remaining for a stake to be claimed or unstaked
     */
    function getRemainingLockTime() external view override returns (uint256) {
        // Return the time remaining for the stake to be claimed or unstaked
        Staker memory staker = stakers[msg.sender];
        if (block.timestamp > staker.unlockTimestamp) {
            return 0;
        }

        return staker.unlockTimestamp - block.timestamp;
    }

    ////////////////////////////////////
    /* ERC-165 */
    ////////////////////////////////////

    function supportsInterface(bytes4 interfaceId)
    public
    view
    virtual
    override(ERC721, ERC721URIStorage, IStakingERC721)
    returns (bool) {
        return interfaceId == type(IStakingERC721).interfaceId
            || super.supportsInterface(interfaceId);
    }

    function getInterfaceId() external pure override returns (bytes4) {
        return type(IStakingERC721).interfaceId;
    }

    ////////////////////////////////////
    /* Token Functions */
    ////////////////////////////////////

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function setBaseURI(string memory baseUri) external override onlyOwner {
        baseURI = baseUri;
        emit BaseURIUpdated(baseUri);
    }

    function setTokenURI(
        uint256 tokenId,
        string memory tokenUri
    ) external override onlyOwner {
        _setTokenURI(tokenId, tokenUri);
    }

    function tokenURI(uint256 tokenId)
	public 
	view 
	override(ERC721URIStorage, ERC721)
	returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    ////////////////////////////////////
    /* Internal Functions Staking */
    ////////////////////////////////////

    function _getPendingRewards(
        Staker storage staker
    ) internal view returns (uint256) {
        // Return any existing pending rewards value plus the
        // calculated rewards based on the last updated timestamp
        return
            staker.pendingRewards +
            _calculateRewards(
                block.timestamp - staker.lastUpdatedTimestamp,
                staker.numStaked
            );
    }

    function _stake(uint256 tokenId, string memory tokenUri) internal {
        // Transfer their NFT to this contract
        IERC721(stakingToken).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Mint user sNFT
        _safeMint(msg.sender, tokenId, tokenUri);

        emit Staked(tokenId, stakingToken);
    }

    function _claim(Staker storage staker) internal {
        // Require the time lock to have passed
        _onlyUnlocked(staker.unlockTimestamp);

        // Returns the calculated rewards since the last time stamp + pending rewards
        uint256 rewards = _getPendingRewards(staker);

        staker.lastUpdatedTimestamp = block.timestamp;
        staker.pendingRewards = 0;

        // Disallow rewards when balance is 0
        if (_getContractRewardsBalance() == 0) {
            revert NoRewardsLeftInContract();
        }

        rewardsToken.transfer(msg.sender, rewards);

        emit Claimed(rewards, address(rewardsToken));
    }

    function _unstake(uint256 tokenId) internal onlySNFTOwner(tokenId) {
        _burn(tokenId);

        // Return NFT to staker
        IERC721(stakingToken).safeTransferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Unstaked(tokenId, stakingToken);
    }

    function _getContractRewardsBalance() internal view returns (uint256) {
        return rewardsToken.balanceOf(address(this));
    }

    function _onlyUnlocked(uint256 unlockTimestamp) internal view {
        // User is not staked or has not passed the time lock
        if (unlockTimestamp == 0 || block.timestamp < unlockTimestamp) {
            revert TimeLockNotPassed();
        }
    }

    ////////////////////////////////////
    /* Internal Functions Token */
    ////////////////////////////////////

    function _safeMint(address to, uint256 tokenId, string memory tokenUri) internal {
        ++_totalSupply;
        super._safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function _mint(address to, uint256 tokenId, string memory tokenUri) internal {
        ++_totalSupply;
        super._mint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function _burn(uint256 tokenId) internal override(ERC721URIStorage, ERC721) {
        super._burn(tokenId);
        --_totalSupply;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

	/**
	 * @dev Disallow all transfers, only `_mint` and `_burn` are allowed
	 */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256,
        uint256
    ) internal pure override {
        if (from != address(0) && to != address(0)) {
            revert NonTransferrableToken();
        }
    }
}
