import * as hre from "hardhat";

import abi from "./bridge_abi.json";

import { getBridge, getERC721Token, getUpgradeableToken } from "./helpers";
import { BRIDGE_ADDRESS, SEP_NET_ID, SEP_OWN_UPGR_TST_ADDRESS, SEP_TNFT_ADDRESS, SEP_TST_ADDRESS, SEP_UPGR_TST_ADDRESS, ZCHAIN_MEOW_ADDRESS } from "./helpers/constants";
import { MockERC20Upgradeable, MockERC20Upgradeable__factory } from "../typechain";


// Call to "bridgeAsset" using the Polygon ZKEVM Bridge for either Sepolia or ZChain
async function main() {
  const [userD, userE] = await hre.ethers.getSigners();

  const bridge = getBridge(userD);

  const factory = await hre.ethers.getContractFactory("MockERC20Upgradeable");
  const token = await factory.attach(ZCHAIN_MEOW_ADDRESS) as MockERC20Upgradeable;

  const amount = hre.ethers.parseEther("1");

  // Allow the bridge to spend transferred amount
  await token.connect(userD).approve(BRIDGE_ADDRESS, amount);

  const zchainId = 1

  try {
    const tx = await bridge.connect(userD).bridgeAsset(
      zchainId,
      userD.address,
      amount,
      hre.ethers.ZeroAddress, // token contract address
      true,
      "0x",
      {
        // value: amount,
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