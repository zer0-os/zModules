// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IZeroRewardsVault {
    function merkleRoot() external view returns (bytes32);
  
    function rewardsVault() external view returns (IERC20);
  
    function totalClaimed() external view returns (uint256);
  
    function claimed(address user) external view returns (uint256);

    function setRewardsVault(address _rewardsVault) external;
  
    function setMerkleRoot(bytes32 _root) external;
  
    function setMerkleRootAndFundVault(bytes32 _root, uint256 amount) external;

    function claim(uint256 amount, bytes32[] calldata merkleProof) external;
}
