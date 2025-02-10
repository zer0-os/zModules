// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ERC20Mod } from "./ERC20Mod.sol";


// Don't enforce linter in mock token
/* solhint-disable */
contract MockERC20 is ERC20Mod, Ownable, Pausable {
    constructor(
        string memory name,
        string memory symbol,
        address owner
    )
        ERC20Mod(name, symbol)
        Ownable(owner) {
        _mint(owner, 10 * 10 ** 18);
    }

    function mint(address to, uint256 amount) public onlyOwner whenNotPaused {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyOwner whenNotPaused {
        _burn(from, amount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function transfer(address recipient, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transfer(recipient, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override whenNotPaused returns (bool) {
        return super.transferFrom(sender, recipient, amount);
    }

    function approve(address spender, uint256 amount) public override whenNotPaused returns (bool) {
        return super.approve(spender, amount);
    }
}
