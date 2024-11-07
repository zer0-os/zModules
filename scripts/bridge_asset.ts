import * as hre from "hardhat";

import abi from "./bridge_abi.json";

import { getBridge, getERC721Token, getUpgradeableToken } from "./helpers";
import { SEP_NET_ID, SEP_TNFT_ADDRESS, SEP_TST_ADDRESS, SEP_UPGR_TST_ADDRESS, ZCHAIN_TST_ADDRESS } from "./constants";


// Call to "bridgeAsset" using the Polygon ZKEVM Bridge for either Sepolia or ZChain
async function main() {
  const [userD] = await hre.ethers.getSigners();

  const bridge = getBridge();
  const token = await getUpgradeableToken(userD);
  // const token = await getERC721Token(userD);

  // zchain network ID = 1 
  const zchainId = 1
  const amount = 1;

  // const amount = hre.ethers.parseEther("1");

  // Allow the bridge to spend transferred amount
  await token.connect(userD).approve(await bridge.getAddress(), amount);

  try {
    const tx = await bridge.connect(userD).bridgeAsset(
      zchainId,
      userD.address,
      amount,
      SEP_UPGR_TST_ADDRESS,
      // SEP_TNFT_ADDRESS,
      true,
      "0x",
      {
      //   // value: amount,
        gasLimit: 1000000,
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