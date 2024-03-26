// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721NonTransferable is ERC721 {
	constructor(
		string memory name,
		string memory symbol
	) ERC721(name, symbol) {}

	// Disallow all transfers, only `_mint` and `_burn` are allowed
	function _beforeTokenTransfer(
		address from,
		address to,
		uint256
	) internal pure {
		require(
			from == address(0) || to == address(0),
			"ERC721Untransferable: token is untransferrable"
		);
	}
}