// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { IVotes } from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import { IERC5267 } from "@openzeppelin/contracts/interfaces/IERC5267.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IZeroVotingERC20 is
    IAccessControl,
    IERC20,
    IERC20Permit,
    IERC5267,
    IVotes {

    error NonTransferrableToken();

    function mint(
        address account,
        uint256 value
    ) external;

    function burn(
        address account,
        uint256 amount
    ) external;
}
