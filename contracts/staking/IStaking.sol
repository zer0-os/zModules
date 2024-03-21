// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO st: Should there be a shared interface for stuff like this?
// or should we just have one for each contract?
interface IStaking {
    // Staked event for ERC721, ERC20, and ERC1155 tokens
    event Staked(
        uint256 indexed tokenId,
        uint256 indexed amount,
        uint256 indexed index,
        address staker
    );

    event Claimed(
        uint256 indexed amount,
        address staker
    );
}