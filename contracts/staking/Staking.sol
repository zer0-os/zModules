// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC721, ERC721Wrapper } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Wrapper.sol";
import { IStaking } from "./IStaking.sol";
import { ABaseStaking } from "./ABaseStaking.sol";
import { Types } from "./Types.sol";
import { AnyToken } from "./AnyToken.sol";


contract Staking is
    ERC721Wrapper
{
	// ABAseStaking

	// The current staking configuration that defines what token is being staked
    // and how rewards are distributed
    Types.PoolConfig public config;

    // Mapping of when a token staking rewards were most recently accessed.
    // On an initial stake, this is set to the current block for future calculations.
    mapping(uint256 tokenId => uint256 blockNumber) public stakedOrClaimedAt;

    // This mapping is kept to always be able to return the NFT to the original staker
    // to allow the SNFT to be transferable
    mapping(uint256 tokenId => address staker) public originalStakers;

    // Only the owner of the representative stake NFT
    modifier onlySNFTOwner(uint256 tokenId) {
        require(
            ownerOf(tokenId) == msg.sender,
            "Caller is not the owner of the representative stake token"
        );
        _;
    }

    // Only the original NFT owner
    modifier onlyNFTOwner(uint256 tokenId) {
        require(
            // Casting must be known at runtime, how do we do this?
            IERC721(config.stakingToken).ownerOf(tokenId) == msg.sender,
            "Caller is not the original staker"
        );
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        IERC721 _stakingToken,
        Types.PoolConfig memory _config
    ) ERC721(name, symbol) ERC721Wrapper(_stakingToken) {
        config = _config;
    }

    // stake any token
    // typeId indicates the type of the token to be staked
    function stakeAnyToken(
        Types.TokenType index,
        uint256 tokenId,
        uint256 amount,
        bytes32 data
    ) public {
        // typeId == 0 => ERC721, take tokenId
        // typeId == 1 => ERC20, take amount
        //
    }

    // stake NFT
    function stake(uint256 tokenId) public onlyNFTOwner(tokenId) {
        // Params
        // ERC721 => tokenId
        // ERC1155
        require(stakedOrClaimedAt[tokenId] == 0, "Token is already staked");

        // Mark when the token was staked
        stakedOrClaimedAt[tokenId] = block.number;

        // Log the original user that staked this token
        originalStakers[tokenId] = msg.sender;

        // Transfer the token to this contract
        IERC721(config.stakingToken).transferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        // Mint a new representative token to the staker
        // TODO if this token is to be transferrable, we have to
        // figure out if we want claimable rewards to split with
        // the owner of this token and the original staker.
        // Does the owner of this token have to pay a fee to the original staker?
        _mint(msg.sender, tokenId);
        // emit
    }

    // unstake
    function unstake(uint256 tokenId) public onlySNFTOwner(tokenId) {
        // Burn the representative token to symbolize the ending of the stake
        _burn(tokenId);

        // Transfer the NFT back to the original owner
        IERC721(config.stakingToken).transferFrom(
            address(this),
            originalStakers[tokenId],
            tokenId
        );

        // Capture the most recent access block number
        uint256 accessBlock = stakedOrClaimedAt[tokenId];

        // Mark as unstaked
        stakedOrClaimedAt[tokenId] = 0;

        // Transfer funds
        IERC20(config.rewardsToken).transfer(
            msg.sender,
            config.rewardWeight * (block.number - accessBlock)
        );
    }

    // claim
    function claim(uint256 tokenId) public onlySNFTOwner(tokenId) {
        // only owner of that stake
        // TODO split claim with original staker?
        uint256 accessBlock = stakedOrClaimedAt[tokenId];

        stakedOrClaimedAt[tokenId] = block.number;

        // Send half to msg.sender and half to original staker?
        // if they are different addresses only
        // maybe if they are different addresses rewardsPerBlock is some % higher
        // like 1.1x or 1.2x
        IERC20(config.rewardsToken).transfer(
            msg.sender,
            config.rewardWeight * (block.number - accessBlock)
        );
        // emit
    }

    // Show the amount of rewards accrued for a given token
    function pendingRewards(uint256 tokenId) public view returns (uint256) {
        return
            config.rewardWeight *
            (block.number - stakedOrClaimedAt[tokenId]);
    }

    // Show the amount of rewards token remaining in this pool
    function availableRewards() public view returns (uint256) {
        return IERC20(config.rewardsToken).balanceOf(address(this));
    }
}
