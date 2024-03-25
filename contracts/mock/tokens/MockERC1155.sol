// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/* solhint-disable */

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockERC1155 is ERC1155 {
	uint256 public constant ASSET_ONE = 0;
	uint256 public constant ASSET_TWO = 1;

    constructor(string memory uri) ERC1155(uri) {
		// Create 100 of  a non-fungible asset
		_mint(msg.sender, ASSET_ONE, 100, "");

		// Create a fungible asset
		_mint(msg.sender, ASSET_TWO, 9000000000*10**18, "");
    }
}
