// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";
import { StakingBase } from "../StakingBase.sol";


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
        uint256 _timeLockPeriod,
        address contractOwner
    )
        ERC721(name, symbol)
        StakingBase(
            _stakingToken,
            _rewardsToken,
            _rewardsPerPeriod,
            _periodLength,
            _timeLockPeriod,
            contractOwner
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

        _checkRewards(staker);

        uint256 i;
        for (i; i < tokenIds.length; ) {
            _stake(tokenIds[i], tokenUris[i]);

            unchecked {
                ++i;
            }
        }

        staker.amountStaked += tokenIds.length;
        staker.lastUpdatedTimestamp = block.timestamp;
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

    ////////////////////////////////////
    /* Internal Staking Functions */
    ////////////////////////////////////

    function _stake(uint256 tokenId, string memory tokenUri) internal {
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
