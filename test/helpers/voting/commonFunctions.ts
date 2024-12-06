import { ethers } from "hardhat";


// Helper function to mine a specific number of blocks
export const mineBlocks = async (numberOfBlocks : number) => {
  for (let i = 0; i < numberOfBlocks; i++) {
    await ethers.provider.send("evm_mine", []);
  }
};


// This is done, because `signer.address` does not match the account in the error due to case of letters.
export const getAccessRevertMsg = (addr : string, role : string) : string =>
  `AccessControl: account ${addr.toLowerCase()} is missing role ${role}`;