// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library Math {
    function pow(uint256 base, uint256 exponent) internal pure returns (uint256) {
        uint256 result = 1;
        for (uint256 i = 0; i < exponent; i++) {
            result *= base;
        }
        return result;
    }

    function exp(uint256 x) internal pure returns (uint256) {
        // Assuming a fixed point representation (e.g., 1e18 for precision)
        // We'll use e^(x/365) = 5^(x/365)
        return (pow(5, x) / pow(365, x)); // Simplified for integers, adjust as necessary
    }
}