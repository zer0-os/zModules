// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IStakingERC721 } from "./IStakingERC721.sol";

// TODO rename so not similar to StakingBase
import { StakingBase } from "../StakingBase.sol";
import { AStakeToken } from "../../tokens/AStakeToken.sol";


/**
 * @title Staking721
 * @notice A staking contract that allows depositing ERC721 tokens and mints a
 * non-transferable ERC721 token in return as representation of the deposit.
 */
contract StakingERC721 is StakingBase, AStakeToken, IStakingERC721 {
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
	AStakeToken(name, symbol, baseUri)
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

        _ifRewards(staker);

        uint256 i;
        for (i; i < tokenIds.length;) {
            _stake(tokenIds[i], tokenUris[i]);

            unchecked {
                ++i;
            }
        }

        staker.amountStaked += tokenIds.length;
        staker.lastUpdatedTimestamp = block.timestamp;
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
            claim();
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
}
