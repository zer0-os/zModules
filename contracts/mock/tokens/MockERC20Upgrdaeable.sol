// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

// import { ERC20Mod } from "./ERC20Mod.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";


contract MockERC20Upgradeable is ERC20Upgradeable {
    function initialize(string memory name, string memory symbol) initializer public {
        __ERC20_init(name, symbol);
        _mint(msg.sender, 9000000000000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }
}
