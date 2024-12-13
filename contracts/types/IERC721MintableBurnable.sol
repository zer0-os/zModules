// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


interface IERC721MintableBurnable {
    function mint(address account, uint256 tokenId) external;

    function safeMint(address account, uint256 tokenId) external;

    function burn(uint256 tokenId) external;
}
