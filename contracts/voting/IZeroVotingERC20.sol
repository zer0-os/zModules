// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

interface IZeroVotingERC20 is IERC20, IERC20Permit {
    /**
     * @dev External mint function. Mints a specified amount of tokens to a specified account.
     * @param account The address that will receive the minted tokens.
     * @param value The amount of tokens to mint to the specified account.
     */
    function mint(address account, uint256 value) external;

    /**
     * @dev External burn function. Burns a specified amount of tokens from the sender account.
     * @param account The address from which the tokens will be burned.
     * @param amount The amount of tokens to burn.
     */
    function burn(address account, uint256 amount) external;

    /**
     * @dev Updates the state of the contract based on a transfer of value 
     *      from one address to another.
     * @param from The address from which the value is being transferred. 
     *             Use `address(0)` if minting new tokens.
     * @param to The address to which the value is being transferred. 
     *           Use `address(0)` if burning tokens.
     * @param value The amount of value being transferred. Must be greater than zero.
     */
    function update(address from, address to, uint256 value) external;

    /**
     * @dev Returns the current nonce for `owner`.
     * This value must be included whenever a signature is generated for {permit}.
     * Every successful call to {permit} increases ``owner``'s nonce by one.
     * This prevents a signature from being used multiple times.
     * @param owner The address of the token owner.
     * @return The current nonce for the given owner.
     */
    function nonces(address owner) external view returns (uint256);
}