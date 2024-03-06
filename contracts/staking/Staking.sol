// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {IStaking} from "./IStaking.sol";

// TODO idea, maybe receival of SNFT is what triggers unstake?
// ERC721Wrapper makes the underlying token to be immutable, but we want to be able to change it
// import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract Staking is ERC721, IStaking {

    // The current staking configuration that defines what token is being staked
    // and how rewards are distributed
    StakeConfig public config;

    // The operator of this contract
    address public admin;

    // Mapping of when a token staking rewards were most recently accessed.
    // On an initial stake, this is set to the current block for future calculations.
    mapping(uint256 tokenId => uint256 blockNumber) public stakedOrClaimedAt;

    // This mapping is kept to always be able to return the NFT to the original staker
    // to allow the SNFT to be transferable
    mapping(uint256 tokenId => address staker) public originalStakers;

    // Only the admin of the contract
	// TODO consider not even having an admin here and just
	// setting the config one time on deploy
    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

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
            config.stakingToken.ownerOf(tokenId) == msg.sender,
            "Caller is not the original staker"
        );
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        StakeConfig memory _config
    ) ERC721(name, symbol) {
        admin = msg.sender;
        config.rewardsPerBlock = _config.rewardsPerBlock;
        config.stakingToken = _config.stakingToken;
        config.rewardsToken = _config.rewardsToken;
    }

    // stake NFT
    function stake(uint256 tokenId) public override onlyNFTOwner(tokenId) {
        require(stakedOrClaimedAt[tokenId] == 0, "Token is already staked");

        // Mark when the token was staked
        stakedOrClaimedAt[tokenId] = block.number;

        // Log the original user that staked this token
        originalStakers[tokenId] = msg.sender;

        // Transfer the token to this contract
        config.stakingToken.transferFrom(msg.sender, address(this), tokenId);

        // Mint a new representative token to the staker
        _mint(msg.sender, tokenId);
        // emit
    }

    // unstake
    function unstake(uint256 tokenId) public override onlySNFTOwner(tokenId) {
        config.stakingToken.transferFrom(
            address(this),
            originalStakers[tokenId],
            tokenId
        );

        // Burn the representative token to symbolize the ending of the stake
        _burn(tokenId);

		uint256 accessBlock = stakedOrClaimedAt[tokenId];
        stakedOrClaimedAt[tokenId] = 0;

        // Transfer funds
        config.rewardsToken.transfer(
            msg.sender,
            config.rewardsPerBlock * (block.number - accessBlock)
        );
    }

    // claim
    function claim(uint256 tokenId) public override onlySNFTOwner(tokenId) {
        // only owner of that stake
        // split claim with original staker?
        uint256 accessBlock = stakedOrClaimedAt[tokenId];
		
		stakedOrClaimedAt[tokenId] = block.number;

        config.rewardsToken.transfer(
            msg.sender,
            config.rewardsPerBlock * (block.number - accessBlock)
        );
        // emit
    }
}
