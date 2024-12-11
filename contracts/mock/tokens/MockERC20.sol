// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Mod } from "./ERC20Mod.sol";

// Don't enforce linter in mock token
/* solhint-disable */
contract MockERC20 is ERC20Mod {
    constructor(string memory name, string memory symbol) ERC20Mod(name, symbol) {
        _mint(msg.sender, 9000000000000 * 10 ** 18);
    }
    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }
}
