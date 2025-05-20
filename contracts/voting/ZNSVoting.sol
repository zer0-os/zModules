// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import { ZeroVotingERC721 } from "./ZeroVotingERC721.sol";


// TODO 15: figure out if this should be hardcoded or immutable!

// TODO: only those who actually play can vote
// Security:
// Check domain/subdomain ownership before creating DAO and token
// Can Voting Token be reassigned to another domain?
// DAO can optionally own a domain if owners delegate it to DAO

contract ZNSVoting is ZeroVotingERC721 {

    mapping(bytes32 => address) public domainHashToToken;

    constructor(
        string memory name,
        string memory symbol,
        string memory baseUri,
        string memory domainName,
        string memory domainVersion,
        address admin,
        address registry
    ) ZeroVotingERC721(
        name,
        symbol,
        baseUri,
        domainName,
        domainVersion,
        admin
    ) {
        __baseURI = baseUri;
    }

    function mint(
        bytes32 domainHash,
        // TODO: do we pass URI?
        string memory tokenUri
    ) public override onlyRole(MINTER_ROLE) {
        require(
            registry.exists(domainHash),
            "Domain does not exist"
        );

        require(
            registry.getDomainOwner(domainHash) == msg.sender,
            "Not the owner of the domain"
        );

        super._mint(
            msg.sender,
            uint256(domainHash),
            string(abi.encodePacked(__baseURI, tokenUri))
        );
    }

    function burn(
        bytes32 domainHash
    ) public override onlyRole(BURNER_ROLE) {
        require(
            registry.exists(domainHash),
            "Domain does not exist"
        );

        require(
            registry.getDomainOwner(domainHash) == msg.sender,
            "Not the owner of the domain"
        );

        super.burn(tokenId);
    }
}