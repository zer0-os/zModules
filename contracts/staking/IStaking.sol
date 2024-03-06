// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IStaking {
    struct StakeConfig {
        IERC721 stakingToken;
        IERC20 rewardsToken;
        uint256 rewardsPerBlock;
    }

	function stake(uint256 tokenId) external;

	function unstake(uint256 tokenId) external;

	function claim(uint256 tokenId) external;
}