// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IERC20MintableBurnable is IERC20 {
    function mint(address account, uint256 value) external;

    function burn(address account, uint256 value) external;
}
