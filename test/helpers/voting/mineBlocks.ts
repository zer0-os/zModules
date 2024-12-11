import * as hre from "hardhat";


export const mineBlocks = async (period : number) => {
  await hre.ethers.provider.send(
    "hardhat_mine",
    [period, 12]
  );
};
