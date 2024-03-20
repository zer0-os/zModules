// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Types } from "./Types.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";


contract StakingPool is ERC721, Types {
    // The operator of this contract
    address public admin;

    // Mapping to track staking configurations
    mapping(bytes32 poolId => PoolConfig config) public pools;

    /**
     * @notice Restrict functions to be useable only by the `admin` set on deployment
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Caller is not the admin");
        _;
    }

    /**
     * @notice Confirm if a pool exists before being able to stake in it.
     */
    modifier poolExists(bytes32 poolId) {
        require(
            address(pools[poolId].stakingToken) != address(0),
            "Staking pool does not exist"
        );
        _;
    }

    function _createPool(PoolConfig memory _config) internal {
        // Staking token must not be zero
        require(
            address(_config.stakingToken) != address(0),
            // TODO st: can we turn these into errors to save gas?
            "Staking token must not be zero"
        );

        // TODO st: what is the purpose of a pool like that? just storing tokens?
        // Rewards token can optionally be 0 if there are no rewards in a pool
        if (address(_config.rewardsToken) != address(0)) {
            require(
                _config.rewardWeight != 0,
                "Invalid rewards configuration"
            );
        }

        require(
        // Enum for token types is
        // 0 - ERC721
        // 1 - ERC20
        // 2 - ERC1155
            uint256(_config.stakingTokenType) <= uint256(type(TokenType).max),
            "Invalid stake or rewards token type"
        );

        bytes32 poolId = _getPoolId(_config);

        // Staking configuration must not already exist
        require(
            address(pools[poolId].stakingToken) == address(0),
            "Staking configuration already exists"
        );

        pools[poolId] = _config;
        emit PoolCreated(poolId, _config);
    }

    function _getPoolId(
        PoolConfig memory _config
    ) internal pure returns (bytes32) {
        return
            keccak256(
            abi.encodePacked(
                _config.stakingToken,
                _config.rewardsToken,
                _config.rewardWeight,
                _config.minRewardsTime
            )
        );
    }

    // TODO st: make this formula perfect, connect it to all the logic and swap this one.
    function _calculateRewards(
        uint256 timePassed,
        uint256 poolWeight,
        uint256 rewardPeriod,
        uint256 stakeAmount
    ) internal view returns (uint256) {
        // TODO st: this formula is bad and is a placeholder for now !!
        return poolWeight * stakeAmount * timePassed / rewardPeriod;
    }

    /**
     * @notice Set the new admin for this contract. Only callable by
     * the current admin.
     * @param _admin The new admin to set
     */
    function setAdmin(address _admin) public onlyAdmin {
        require(_admin != address(0), "Admin cannot be zero address");
        admin = _admin;
        // TODO st: add event
    }
}
