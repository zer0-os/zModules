// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../escrow/Escrow.sol";

interface IMatch {
    /** 
     * @notice Checks if all players have enough balance in escrow to participate in the match
     * @param players Array of player addresses
     * @param escrowRequired The required balance in escrow for each player to participate
     * @return bool Returns true if all players have enough balance, false otherwise
     */
    function canMatch(address[] memory players, uint256 escrowRequired) external view returns(bool);

    /** 
     * @notice Pays an equal amount from the escrow to each winner
     * @param amount The amount to pay to each winner
     * @param winners Array of winner addresses
     */
    function payAllEqual(uint256 amount, address[] memory winners) external;

    /** 
     * @notice Pays varying amounts from the escrow to each winner
     * @param amounts Array of amounts to pay to each winner
     * @param winners Array of winner addresses
     */
    function payAllAmounts(uint256[] memory amounts, address[] memory winners) external;

    /**
     * @notice Sets a new escrow contract address
     * @param newEscrow The address of the new escrow contract
     */
    function setEscrow(Escrow newEscrow) external;
}

