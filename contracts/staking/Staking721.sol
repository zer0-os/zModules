// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Types } from "./Types.sol";
import  { StakingPool } from "./StakingPool.sol";
import  { IStaking721 } from "./IStaking721.sol";

contract Staking721 is ERC721, StakingPool, IStaking721 {
    Types.PoolConfig public config;

    // Track number of stakes for a user with their stake nonce
    mapping(address user => uint256 currentStakeNonce) public stakeNonces;

    // Rewards tallied to the user for additional stakes to be claimed
    mapping(address user => uint256 rewards) public rewardsOwed;

    // Track for each stake when it was most recently accessed
    mapping(uint256 tokenId => uint256 blockNumber) public stakedOrClaimedAt;

    // Throw when the caller is not the owner of the given token
    error InvalidOwner(string message);

    // Throw when caller is unable to claim rewards
    error InvalidClaim(string message);

    // Only the owner of the representative stake NFT
    modifier onlySNFTOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner("Caller is not the owner of the representative stake token");
        }
        _;
    }

    constructor(
		string memory name,
		string memory symbol,
		Types.PoolConfig memory _config
	) ERC721(name, symbol) {
        _createPool(_config); // do we need concept of pools?
        config = _config;
	}

    function stake(uint256 tokenId) external {
        if (IERC721(config.stakingToken).ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner("Staking721: Caller is not the owner of the token");
        }

        // Accrue rewards if they have staked before
        if (stakeNonces[msg.sender] != 0) {
            rewardsOwed[msg.sender] += _calculateRewards(msg.sender);
        }

        // Mark when the token was staked
        stakedOrClaimedAt[tokenId] = block.timestamp;

        // Transfer the NFT to this contract
        IERC721(config.stakingToken).transferFrom(
            msg.sender,
            address(this),
            tokenId
        );
        
        // Mint user SNFT
        _mint(msg.sender, tokenId);
        emit Staked(tokenId, msg.sender);
    }

    function claim(uint256 tokenId) external onlySNFTOwner(tokenId) {
        // TODO ST: implement
        uint256 accessTime = stakedOrClaimedAt[tokenId];

        if (block.timestamp - accessTime < config.minRewardsTime) {
            revert InvalidClaim("Staking721: Cannot claim rewards yet");
        }
        
        // _calculateRewards will add in any additional amount from `rewardsOwed`
        // TODO st: implement calc rewards
        uint256 rewards = _calculateRewards(msg.sender);

        if (rewards == 0) {
            revert InvalidClaim("Staking721: No rewards to claim");
        }

        // update block timestamp before transfer
        // TODO st: this is set in memory, not storage, fix !!!
		stakedOrClaimedAt[tokenId] = block.timestamp;

        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );
        
    }

    function unstake() external {
        // TODO ST: implement
    }

    // View the balance of this pool in the reward token
    function viewRewardsInPool() external view returns (uint256) {
        return IERC20(config.rewardsToken).balanceOf(address(this));
    }

    // view the rewards waiting to be claimed for a user
    function viewPendingRewards() external view returns (uint256) {
        // TODO ST: implement
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _calculateRewards(address user) internal returns (uint256) {
        // TODO ST: implement
        return 0;
    }

    // TODO st: consider making custom version of ERC712Wrapper to keep this
    // Only `_mint` and `_burn`
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal pure override {
        // The SNFT is not transferrable
        require(from == address(0) || to == address(0), "Token is non-transferable");
    }
}