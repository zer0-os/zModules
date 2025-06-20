// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IZeroRewardsVault {
    function totalClaimed() external view returns (uint256);

    function token() external view returns (address);

    function claimed(address user) external view returns (uint256);

    function setMerkleRoot(bytes32 _root) external;

    function setToken(address _token) external;

    function pause() external;

    function unpause() external;

    function claim(uint256 totalCumulativeRewards, bytes32[] calldata merkleProof) external;
}
