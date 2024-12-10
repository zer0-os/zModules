// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC721Votes } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";


contract VotingERC721Mock is ERC721Votes {

    constructor() ERC721("VotingERC721Mock", "VNFTM") EIP712("name", "123") {}

    function mint(address to, uint id) external {
        _safeMint(to, id);
    }
}
