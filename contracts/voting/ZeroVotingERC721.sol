// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC721Votes } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IZeroVotingERC721 } from "./IZeroVotingERC721.sol";


contract ZeroVotingERC721 is ERC721Votes, ERC721URIStorage, AccessControl, IZeroVotingERC721 {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /**
     * @notice Base URI used for ALL tokens. Can be empty if individual URIs are set.
     */
    string internal baseURI;

    /**
     * @notice Total supply of all tokens
     */
    uint256 internal _totalSupply;

    /**
     * @dev Initializes the ERC721 token with a name, symbol.
     * @param name The name of the ERC721 token.
     * @param symbol The symbol of the ERC721 token.
     * @param domainName The name of the EIP712 signing domain.
     * @param domainVersion The version of the EIP712 signing domain.
     * @param admin The admin of contract.
    */
    constructor(
        string memory name,
        string memory symbol,
        string memory baseUri,
        string memory domainName,
        string memory domainVersion,
        address admin
    )
        ERC721(name, symbol)
        EIP712(domainName, domainVersion)
    {
        if (admin != address(0)) {
            _grantRole(DEFAULT_ADMIN_ROLE, admin);
        } else {
            revert ZeroAddressError();
        }

        if (bytes(baseUri).length > 0) {
            baseURI = baseUri;
        }
    }

    /**
     * @dev External mint function. Mints a new token to a specified address.
     * @param to The address that will receive the minted token.
     * @param tokenId The token ID for the newly minted token.
     */
    function mint(
        address to,
        uint256 tokenId,
        string memory tokenUri
    ) external override onlyRole(MINTER_ROLE) {
        ++_totalSupply;

        _mint(
            to,
            tokenId
        );

        _setTokenURI(tokenId, tokenUri);
    }

    /**
     * @dev Mints `tokenId`, transfers it to `to` and checks for `to` acceptance.
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received},
     * which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function safeMint(
        address to,
        uint256 tokenId,
        string memory tokenUri
    ) external override onlyRole(MINTER_ROLE) {
        ++_totalSupply;

        _safeMint(
            to,
            tokenId
        );

        _setTokenURI(tokenId, tokenUri);
    }

    /**
     * @dev External burn function. Burns a token for a specified address.
     * @param tokenId The token ID of the token to burn.
     */
    function burn(
        uint256 tokenId
    ) external override onlyRole(BURNER_ROLE) {
        --_totalSupply;

        _burn(tokenId);
    }

    function setBaseURI(string memory baseUri) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = baseUri;
        emit BaseURIUpdated(baseUri);
    }

    function setTokenURI(
        uint256 tokenId,
        string memory tokenUri
    ) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTokenURI(tokenId, tokenUri);
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage, IZeroVotingERC721) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165, AccessControl, ERC721, ERC721URIStorage) returns (bool) {
        return
            interfaceId == type(IZeroVotingERC721).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function getInterfaceId() public pure override returns (bytes4) {
        return type(IZeroVotingERC721).interfaceId;
    }

    /**
     * @dev Disallow all transfers, only `_mint` and `_burn` are allowed
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Votes) returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            revert NonTransferrableToken();
        }

        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 amount
    ) internal override(ERC721, ERC721Votes) {
        super._increaseBalance(
            account,
            amount
        );
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
