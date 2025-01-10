import { ethers } from "hardhat";


export const mineBlocks = async (numberOfBlocks : number) => {
  for (let i = 0; i < numberOfBlocks; i++) {
    await ethers.provider.send("evm_mine", []);
  }
};
