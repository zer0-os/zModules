// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC721Votes } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract ZeroVotingERC721 is ERC721Votes, AccessControl {

    bytes32 public constant DEFAULT_ADMIN_ROLE_PUBLIC = DEFAULT_ADMIN_ROLE;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

     /**
     * @dev Initializes the ERC721 token with a name, symbol.
     * @param name The name of the ERC721 token.
     * @param symbol The symbol of the ERC721 token.
     * @param admin The admin of contract.
     */
    constructor(
        string memory name,
        string memory symbol,
        address admin
    )
        ERC721(name, symbol)
        ERC721Votes()
        AccessControl()
    {
        // temporary TODO: decide, who gets the roles
        grantRole(DEFAULT_ADMIN_ROLE, admin);
        grantRole(BURNER_ROLE, admin);
        grantRole(MINTER_ROLE, admin);
    }

    /**
     * @dev External mint function. Mints a new token to a specified address.
     * @param to The address that will receive the minted token.
     * @param tokenId The token ID for the newly minted token.
     */
    function mint(
        address to,
        uint256 tokenId
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, tokenId);
    }

    /**
     * @dev Internal mint function overriding ERC721.
     * @param to The address that will receive the minted token.
     * @param tokenId The token ID for the newly minted token.
     */
    function _mint(
        address to,
        uint256 tokenId
    ) internal override(ERC721) {
        super._mint(to, tokenId);
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
}