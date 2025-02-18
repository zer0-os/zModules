// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IZeroVotingERC20 } from "./IZeroVotingERC20.sol";


contract ZeroVotingERC20 is ERC20Votes, AccessControl, IZeroVotingERC20 {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /**
     * @dev Initializes the token with name and symbol, also sets up ownership.
     * @param name The name of the ERC20 token.
     * @param symbol The symbol of the ERC20 token.
     * @param domainName The name of the EIP712 signing domain.
     * @param domainVersion The version of the EIP712 signing domain.
    */
    constructor(
        string memory name,
        string memory symbol,
        string memory domainName,
        string memory domainVersion,
        address admin
    )
        ERC20(name, symbol)
        EIP712(domainName, domainVersion)
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
     * @dev Returns the current nonce for `owner`.
    */
    function nonces(
        address owner
    ) public view override returns (uint256) {
        return super.nonces(owner);
    }

    /**
     * @dev Disallow all transfers, only `_mint` and `_burn` are allowed
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20Votes) {
        if (from != address(0) && to != address(0)) {
            revert NonTransferrableToken();
        }

        super._update(from, to, value);
    }
}
