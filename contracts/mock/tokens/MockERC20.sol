// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import { ERC20, IERC20 } from  "@openzeppelin/contracts/token/ERC20/ERC20.sol";


interface IMockERC20 is IERC20 {
    function mint(address to, uint256 amount) external;
}

contract MockERC20 is ERC20, IMockERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 9000000000000 * 10 ** 18);
    }

    function mint(address to, uint256 amount) public override virtual {
        _mint(to, amount);
    }
}
