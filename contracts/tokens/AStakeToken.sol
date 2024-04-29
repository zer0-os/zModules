// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";


/**
 * @title AStakeToken
 * @notice A modified version of ERC721 which is issued to the user as a representation of their staked asset(s).
 * @dev Ownership of tokens minted by this contract is used for Access Control in the child staking contract.
 */
abstract contract AStakeToken is Ownable, ERC721URIStorage {
    /**
     * @notice Base URI used for ALL tokens. Can be empty if individual URIs are set.
     */
    string internal baseURI;

    /**
     * @notice Total supply of all tokens
     */
    uint256 internal _totalSupply;

	/**
	 * @dev Throw when trying to transfer the representative sNFT
	 */
	error NonTransferrableToken();

	/**
     * @dev Emitted when the base URI is updated
     * @param baseURI The new base URI
     */
    event BaseURIUpdated(string baseURI);

    constructor(
        string memory name,
        string memory symbol,
        string memory baseUri
    ) ERC721(name, symbol) {
        if (bytes(baseUri).length > 0) {
            baseURI = baseUri;
        }
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

	function setBaseURI(string memory baseUri) external onlyOwner {
        baseURI = baseUri;
        emit BaseURIUpdated(baseUri);
    }

    function setTokenURI(uint256 tokenId, string memory tokenUri) external virtual onlyOwner {
		_setTokenURI(tokenId, tokenUri);
	}

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return super.tokenURI(tokenId);
    }

	/**
	 * @dev Disallow all transfers, only `_mint` and `_burn` are allowed
	 */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256,
        uint256
    ) internal pure override {
        if (from != address(0) && to != address(0)) {
            revert NonTransferrableToken();
        }
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

    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);
        --_totalSupply;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
