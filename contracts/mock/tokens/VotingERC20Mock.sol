// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";


contract VotingERC20Mock is ERC20Votes {
    constructor() ERC20("VotingERC20Mock", "V20M") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
