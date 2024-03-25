// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Types } from "./Types.sol";
import { StakingPool } from "./StakingPool.sol";
import { IStaking } from "./IStaking.sol";

// TODO make Untransferable721.sol that has _beforeTokenTransfer override
// then inherit that contract in each individual staking contract
contract Staking721 is ERC721, StakingPool, IStaking {
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

    modifier onlyNFTOwner(uint256 tokenId) {
        if (IERC721(config.stakingToken).ownerOf(tokenId) != msg.sender) {
            revert InvalidOwner("Staking721: Caller is not the owner of the token");
        }
        _;
    }

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
        _stake(tokenId);
    }

    function stakeBulk(uint256[] calldata tokenIds) external {
        uint i;
        uint len = tokenIds.length;
        for (i; i < len;) {
            _stake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }
    }

    // TODO move this below
    function _stake(uint256 tokenId) internal onlyNFTOwner(tokenId) {
        // Accrue rewards if they have staked before
        if (stakeNonces[msg.sender] != 0) {
            rewardsOwed[msg.sender] += _calculateRewards(
                block.timestamp - stakedOrClaimedAt[tokenId],
                1,
                config
            );
        }

        unchecked {
            ++stakeNonces[msg.sender];
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

        emit Staked(tokenId, 0, 0, config.stakingToken, msg.sender);
    }

    // TODO
    // claimBulk
    // unstakeBulk


    // TODO onlysnftowner in bulk funcs
    function showValues (uint256 tokenId) public view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        return _showValues(
            block.timestamp - stakedOrClaimedAt[tokenId],
            1,
            config
        );
    }

    function showValues2(uint256 tokenId) public view returns (uint256, bool) {
        return _showValues2(
            block.timestamp - stakedOrClaimedAt[tokenId],
            config
        );
    }

    function claim(uint256 tokenId) external onlySNFTOwner(tokenId) {
        uint256 rewards = _calculateRewards(
            block.timestamp - stakedOrClaimedAt[tokenId],
            1,
            config
        );

        // _calculateRewards will return 0 if the time lock period is not met
        if (rewards == 0) {
            revert InvalidClaim("Staking721: No rewards to claim");
        }

        // Update timestamp before transfer
		stakedOrClaimedAt[tokenId] = block.timestamp;

        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );

        emit Claimed(rewards, msg.sender);
    }

    function claimBulk(uint256[] calldata tokenIds) external {
        uint i;
        uint256 rewards;
        uint len = tokenIds.length;
        for (i; i < len;) {
            // If they are not the owner of the SNFT, skip this tokenId
            if (ownerOf(tokenIds[i]) != msg.sender) {
                continue;
            }

            // _calculateRewards will return 0 if the time lock period is not met
            uint256 tempRewards = _calculateRewards(
                block.timestamp - stakedOrClaimedAt[tokenIds[i]],
                1,
                config
            );

            // If there are rewards to be claimed, mark that token as claimed
            if (tempRewards > 0) {
                rewards += tempRewards;
                stakedOrClaimedAt[tokenIds[i]] = block.timestamp;
            }

            unchecked {
                ++i;
            }
        }

        if (rewards == 0) {
            // TODO will revert here when array is all unowned, valid ids
            // is that fine?
            revert InvalidClaim("Staking721: No rewards to claim");
        }

        // Transfer all rewards at once
        config.rewardsToken.transfer(
            msg.sender,
            rewards
        );

        emit Claimed(rewards, msg.sender);
    }

    function unstake(uint256 tokenId) external onlySNFTOwner(tokenId) {
        uint256 rewards = _calculateRewards(
            block.timestamp - stakedOrClaimedAt[tokenId],
            1,
            config
        );

        if (rewards == 0) {
            revert InvalidClaim("Staking721: Unable to unstake");
        }

        // Update timestamp to unstaked
		stakedOrClaimedAt[tokenId] = 0;

        // Burn the sNFT
        _burn(tokenId);

        // Send final rewards to staker
        IERC20(config.rewardsToken).transfer(
            msg.sender,
            rewards
        );

        // Return NFT to staker
        IERC721(config.stakingToken).transferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        emit Unstaked(tokenId, 0, 0, config.stakingToken, msg.sender);
    }

    // In the case that a pool is abandoned or no longer has funds for rewards, allow
    // users to unstake their tokens with no consideration for time lock period
    function removeStake(uint256 tokenId) external onlySNFTOwner(tokenId){
        _removeStake(tokenId);
    }

    function removeStakeBulk(uint256[] calldata tokenIds) external {
        uint256 i;
        uint256 len = tokenIds.length;
        for (i; i < len;) {
            if (ownerOf(tokenIds[i]) != msg.sender) {
                revert InvalidOwner("Caller is not the owner of the representative stake token");
            }
            _removeStake(tokenIds[i]);

            unchecked {
                ++i;
            }
        }
    }

    // View the balance of this pool in the reward token
    function viewRewardsInPool() external view returns (uint256) {
        return IERC20(config.rewardsToken).balanceOf(address(this));
    }

    // view available rewards waiting to be claimed for a user
    function viewPendingRewards(uint256 tokenId) external view returns (uint256) {
        return _calculateRewards(
            block.timestamp - stakedOrClaimedAt[tokenId],
            1,
            config
        );
    }

    ////////////////////////////////////
        /* Internal Functions */
    ////////////////////////////////////

    function _removeStake(uint256 tokenId) internal {
        IERC721(config.stakingToken).transferFrom(
            address(this),
            msg.sender,
            tokenId
        );
        _burn(tokenId);
    }

    // TODO st: consider making custom version of ERC712Wrapper to keep this
    // Only `_mint` and `_burn`
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256,
        uint256
    ) internal pure override {
        // The SNFT is not transferrable
        require(from == address(0) || to == address(0), "Token is non-transferable");
    }
}