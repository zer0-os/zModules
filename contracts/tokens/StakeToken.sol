// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IStakeToken } from "./IStakeToken.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";


/**
 * @title StakeToken
 * @notice A modified version of ERC721 which is issued to the user as a representation of staked asset.
 * @dev Ownership of tokens minted by this contract is used for Access Control in the child staking contract.
 */
abstract contract StakeToken is ERC721, ERC721URIStorage, IStakeToken {
    // TODO stake: - fix and make proper inheritance with interfaces !!!
    //  - does it have to be non-transferrable?!?! what if a user lost his wallet? change name!

    /**
     * @notice Base URI used for ALL tokens. Can be empty if individual URIs are set.
     */
    string internal baseURI;

    /**
     * @notice Total supply of all tokens
     */
    uint256 internal _totalSupply;

    constructor(
        string memory name,
        string memory symbol,
        string memory baseUri
    ) ERC721(name, symbol) {
        if (bytes(baseUri).length > 0) {
            baseURI = baseUri;
        }
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function setBaseURI(string memory baseUri) external virtual;

    function setTokenURI(uint256 tokenId, string memory tokenUri) external virtual;

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721URIStorage, ERC721, IERC165) returns (bool) {
        return interfaceId == type(IStakeToken).interfaceId
            || super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721URIStorage, ERC721) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function _safeMint(address to, uint256 tokenId, string memory tokenUri) internal {
        ++_totalSupply;
        super._safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function _mint(address to, uint256 tokenId, string memory tokenUri) internal {
        ++_totalSupply;
        super._mint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function _burn(uint256 tokenId) internal override(ERC721URIStorage, ERC721) {
        super._burn(tokenId);
        --_totalSupply;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
