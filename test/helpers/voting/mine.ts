import { ethers } from "hardhat";


export const mineBlocks = async (numberOfBlocks : number) => {
  for (let i = 0; i < numberOfBlocks; i++) {
    await ethers.provider.send("evm_mine", []);
  }
};

export const skipSeconds = async (sec : number | bigint) => {
  if (typeof sec === "number") {
    return new Promise(resolve => setTimeout(resolve, sec * 1000));
  } else {
    return new Promise(resolve => setTimeout(resolve, Number(sec) * 1000));
  }
};
