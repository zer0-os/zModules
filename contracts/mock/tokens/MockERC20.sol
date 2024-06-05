// SPDX-License-Identifier: MIT

pragma solidity 0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 9000000000000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) public virtual {
        _mint(to, amount);
    }
}
