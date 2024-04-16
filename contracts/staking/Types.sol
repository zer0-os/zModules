// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";


interface Types {
    struct Staker {
        uint256 unlockTimestamp;
        uint256 pendingRewards;
        uint256 lastUpdatedTimestamp;
        uint256 numStaked;
    }
}
