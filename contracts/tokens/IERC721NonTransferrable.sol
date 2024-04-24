// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";


interface IERC721NonTransferrable is IERC721, IERC721Receiver {
    event BaseURIUpdated(string baseURI);

    error NonTransferrableToken();
}
