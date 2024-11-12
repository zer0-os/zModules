// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// TODO test a second time with msg.sender instead
contract MockERC20Upgradeable is ERC20Upgradeable, OwnableUpgradeable {
    function initialize(
        string memory name,
        string memory symbol,
        address owner
    ) public initializer {
        __Ownable_init(owner);
        __ERC20_init(name, symbol);
        _mint(msg.sender, 9000000000000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }
}
