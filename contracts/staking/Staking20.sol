// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Shared things
import { Types } from "./Types.sol";
import { StakingPool } from "./StakingPool.sol";
import { IStaking } from "./IStaking.sol";

contract StakingERC20 is ERC721, StakingPool, IStaking {
    Types.PoolConfig public config;

    // Counter for the number of stakes by a user
    mapping(address user => uint256 stakedOrClaimedAt) public stakedOrClaimedAt;

    // Total amount staked by a user
    mapping(address user => uint256 amountStaked) public staked;

    // Rewards owed to a user. Added to on each additional stake, set to 0 on claim
    mapping(address user => uint256 pendingRewards) public pendingRewards;

    // Throw when the caller is not the owner of the given token
    error InvalidStake(string message);

    // Throw when caller is unable to claim rewards
    error InvalidClaim(string message);


    // Only the owner of the representative stake NFT
    modifier onlySNFTOwner(uint256 tokenId) {
        if (ownerOf(tokenId) != msg.sender) {
            revert InvalidClaim("Caller is not the owner of the representative stake token");
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

    function stake(uint256 amount) external {
        // Accrue rewards if they have already staked
        if (staked[msg.sender] != 0) {
            pendingRewards[msg.sender] += _calculateRewards(
                block.timestamp - stakedOrClaimedAt[msg.sender],
                staked[msg.sender],
                config
            );
        }

        staked[msg.sender] += amount;
        stakedOrClaimedAt[msg.sender] = block.timestamp;

        IERC20(config.stakingToken).transferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Mint user SNFT
        // TODO st: even need a thing like this here? whats the point
        // why mint sNFT? can we just track on claim with msg.sender in mapping?
        // _mint(msg.sender, uint256(keccak256(abi.encodePacked(msg.sender, amount))));

        emit Staked(0, amount, 0, config.stakingToken);
    }

    function claim() external {
        uint256 rewards = _calculateRewards(
            block.timestamp - stakedOrClaimedAt[msg.sender],
            staked[msg.sender],
            config
        ) + pendingRewards[msg.sender];

        pendingRewards[msg.sender] = 0;
        stakedOrClaimedAt[msg.sender] = block.timestamp;

        IERC20(config.rewardsToken).transfer(msg.sender, rewards);
        emit Claimed(rewards, config.stakingToken);
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    // TODO st: consider making custom version of ERC712Wrapper to keep this
    // Only `_mint` and `_burn`
}