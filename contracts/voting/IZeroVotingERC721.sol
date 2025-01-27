// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IVotes } from "@openzeppelin/contracts/governance/utils/IVotes.sol";


interface IZeroVotingERC721 is IAccessControl, IERC721, IVotes {
    /**
     * @notice Emitted when the base URI is updated
     * @param baseURI The new base URI
     */
    event BaseURIUpdated(string baseURI);

    error NonTransferrableToken();
    error ZeroAddressPassed();

    function mint(
        address to,
        uint256 tokenId,
        string memory tokenUri
    ) external;

    function safeMint(
        address to,
        uint256 tokenId,
        string memory tokenUri
    ) external;

    function burn(
        uint256 tokenId
    ) external;

    function setBaseURI(string memory baseUri) external;

    function setTokenURI(uint256 tokenId, string memory tokenUri) external;


    function totalSupply() external view returns (uint256);

    function tokenURI(uint256 tokenId) external view returns (string memory);

    function getInterfaceId() external pure returns (bytes4);
}
