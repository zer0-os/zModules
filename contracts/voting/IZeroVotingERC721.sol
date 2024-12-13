// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;


interface IZeroVotingERC721 {
    /**
     * @dev Updates the ownership of a token, transferring it to the specified address.
     * This external function is restricted to accounts with the `DEFAULT_ADMIN_ROLE`.
     * It wraps the internal `_update` method provided by the ERC721Votes base contract.
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
    ) external returns (address);

    /**
     * @dev External mint function. Mints a new token to a specified address.
     * @param to The address that will receive the minted token.
     * @param tokenId The token ID for the newly minted token.
     */
    function mint(
        address to,
        uint256 tokenId
    ) external;

    function safeMint(
        address to,
        uint256 tokenId
    ) external;

    /**
     * @dev External burn function. Burns a token for a specified address.
     * @param tokenId The token ID of the token to burn.
     */
    function burn(
        uint256 tokenId
    ) external;

    /**
     * @dev Overridden function to support the interfaces of ERC721 and AccessControl.
     * @param interfaceId The interface identifier to check.
     * @return True if the contract supports the given interface.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) external view returns (bool);
}
