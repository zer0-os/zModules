// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


interface IERC721MintableBurnableURIStorage {
    function mint(address account, uint256 tokenId, string memory tokenUri) external;

    function safeMint(address account, uint256 tokenId, string memory tokenUri) external;

    function burn(uint256 tokenId) external;
}
