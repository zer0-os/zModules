// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC721Votes } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";


contract ZeroVotingERC721 is ERC721Votes, ERC721URIStorage, AccessControl {

    event BaseURIUpdated(string baseURI);

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
    * @param admin The admin of contract.
    */
    constructor(
        string memory name,
        string memory symbol,
        string memory version,
        string memory baseUri,
        address admin
    )
        ERC721(name, symbol)
        EIP712(name, version)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);

        if (bytes(baseUri).length > 0) {
            baseURI = baseUri;
        }
    }

    /**
    * @dev Updates the ownership of a token, transferring it to the specified address.
    *      This external function is restricted to accounts with the `DEFAULT_ADMIN_ROLE`.
    *      It wraps the internal `_update` method provided by the ERC721Votes base contract.
    * @param to The address to which the token will be transferred.
    *           Can be `address(0)` to burn the token.
    * @param tokenId The ID of the token to be updated.
    * @param auth The address authorized to execute this update.
    *             If `address(0)`, no authorization check is performed.
    * @return The address of the previous owner of the token.
    */
    function update(
        address to,
        uint256 tokenId,
        address auth
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        return super._update(
            to,
            tokenId,
            auth
        );
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
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
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
    ) external onlyRole(BURNER_ROLE) {
        _burn(tokenId);
    }

    /**
    * @dev Overridden function to support the interfaces of ERC721 and AccessControl.
    * @param interfaceId The interface identifier to check.
    * @return True if the contract supports the given interface.
    */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setBaseURI(string memory baseUri) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = baseUri;
        emit BaseURIUpdated(baseUri);
    }

    function setTokenURI(
        uint256 tokenId,
        string memory tokenUri
    ) public virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTokenURI(tokenId, tokenUri);
    }

    function getInterfaceId() public pure override returns (bytes4) {
        return type(IStakingERC721).interfaceId;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return
            interfaceId == type(ZeroVotingERC721).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
    * @dev Internal function to update the ownership of a token, transferring it to the specified address.
    * This method overrides the `_update` implementation in the ERC721Votes contract and ensures the
    * balances and ownership mappings are updated correctly, emitting a `Transfer` event.
    */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        return super._update(
            to,
            tokenId,
            auth
        );
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
