// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GasTests {

    error MustBeZero(string message);
    error ZeroError();

    function withRequire(uint256 number) public returns(uint256){
        require(number > 0, "Number must be greater than 0");
        return number * 10**18;
    }

    function withStringMessage(uint256 number) public returns(uint256) {
        if (number == 0) {
            revert MustBeZero("Number must be greater than zero");
        }
        return number * 10**18;
    }

    function withError(uint256 number) public returns(uint256) {
        if (number == 0) {
            revert ZeroError();
        }
        return number * 10**18;
    }

}