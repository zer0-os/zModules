import * as hre from "hardhat";

import abi from "./bridge_abi.json";

import { getBridge } from "./helpers";


// Call to "bridgeAsset" using the Polygon ZKEVM Bridge for either Sepolia or ZChain
async function main() {
  const [userD] = await hre.ethers.getSigners();

  const bridge = getBridge();

  // zchain network ID = 1 
  const zchainId = 1

  // Sepolia ChainID
  const sepChainId = 11155111

  const amount = 1000000000
  try {
    const tx = await bridge.connect(userD).bridgeAsset(
      zchainId,
      userD.address,
      amount,
      hre.ethers.ZeroAddress,
      true,
      "0x",
      {
        value: amount,
        // gasLimit: 1000000,
      }
    )
  
    const receipt = await tx.wait();
  
    console.log(receipt?.hash);
  } catch (e) {
    console.log(e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});