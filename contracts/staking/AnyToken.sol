// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";


// Wrap ERC20, ERC721, and ERC777 into a single contract
contract AnyToken is ERC1155 {

	enum TokenType {
		IERC721,
		IERC1155,
		IERC20
	}

	constructor(string memory uri) ERC1155(uri) {}
}

