// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";


contract ZeroVotingERC20 is ERC20Permit, ERC20Votes, AccessControl {

    bytes32 public constant DEFAULT_ADMIN_ROLE_PUBLIC = DEFAULT_ADMIN_ROLE;
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
        address deployer
    )
        ERC20(name, symbol)
        ERC20Permit(name)
        AccessControl()
    {
        // temporary TODO: decide, who gets the roles
        grantRole(DEFAULT_ADMIN_ROLE, deployer);
        grantRole(BURNER_ROLE, deployer);
        grantRole(MINTER_ROLE, deployer);
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