// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC721Votes } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Votes.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract ZeroVotingERC721 is ERC721Votes, AccessControl {

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
        string memory version,
        address admin
    )
        ERC721(name, symbol)
        EIP712(name, version)
        ERC721Votes()
        AccessControl()
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
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
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        return super._update(
            to,
            tokenId,
            auth
        );
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
    ) internal override(ERC721Votes) returns (address) {
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
        uint256 tokenId
    ) external onlyRole(MINTER_ROLE) {
        _mint(
            to,
            tokenId
        );
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
    
    /**
     * @dev External burn function. Burns a token for a specified address.
     * @param tokenId The token ID of the token to burn.
     */
    function burn(
        uint256 tokenId
    ) external onlyRole(BURNER_ROLE) {
        _burn(tokenId);
    }
}