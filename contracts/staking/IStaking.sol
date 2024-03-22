// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Interface for shared events among staking contracts
interface IStaking {
    // Staked event for ERC721, ERC20, and ERC1155 tokens
    event Staked(
        uint256 indexed tokenId,
        uint256 indexed amount,
        uint256 indexed index,
        address stakingToken,
        address staker
    );
    // TODO stakingTokenType, try without until 1155 and see what's necessary
    // might need for pool validation on creation
    // maybe add address of token that was staked, e.g. stakingToken contract

    event Claimed(
        uint256 indexed amount,
        address staker
    );

    event Unstaked(
        uint256 indexed tokenId,
        uint256 indexed amount,
        uint256 indexed index,
        address stakingToken,
        address staker
    );
}