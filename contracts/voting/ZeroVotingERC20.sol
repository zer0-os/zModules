// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";


contract ZeroVotingERC20 is ERC20Permit, ERC20Votes, AccessControl {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /**
    * @dev Initializes the token with name and symbol, also sets up ERC20Permit and ownership.
    * @param name The name of the ERC20 token.
    * @param symbol The symbol of the ERC20 token.
    */
    constructor(
        string memory name,
        string memory symbol,
        address admin
    )
        ERC20(name, symbol)
        ERC20Permit(name)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /**
     * @dev External mint function. Mints a specified amount of tokens to a specified account.
     * @param account The address that will receive the minted tokens.
     * @param value The amount of tokens to mint to the specified account.
     */
    function mint(
        address account,
        uint256 value
    ) external override onlyRole(MINTER_ROLE) {
        _mint(
            account,
            value
        );
    }

    /**
     * @dev External burn function. Burns a specified amount of tokens from the sender account.
     * @param account Account where tokens need to be burned.
     * @param amount The amount of tokens to burn.
     */
    function burn(
        address account,
        uint256 amount
    ) external override onlyRole(BURNER_ROLE) {
        _burn(
            account,
            amount
        );
    }

    /**
    * @dev Returns the current nonce for `owner`. This value must be
    * included whenever a signature is generated for {permit}.
    *
    * Every successful call to {permit} increases ``owner``'s nonce by one. This
    * prevents a signature from being used multiple times.
    */
    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /**
    * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
    * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
    * this function.
    *
    * Emits a {Transfer} event.
    */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(
            from,
            to,
            value
        );
    }
}
