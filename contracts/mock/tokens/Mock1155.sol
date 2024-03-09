// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/* solhint-disable */

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC1155 is ERC1155 {
	// TODO not sure what to create at constructor, if anything
	uint256 public constant ASSET1 = 0;
	uint256 public constant ASSET2 = 1;

    constructor(string memory uri) ERC1155(uri) {
		// Create a non-fungible asset
		_mint(msg.sender, ASSET1, 100, "");

		// Create a fungible asset
		_mint(msg.sender, ASSET2, 10**18, "");
    }
}
