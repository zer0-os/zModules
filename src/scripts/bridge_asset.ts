import * as hre from "hardhat";


import { getERC721 } from "./helpers";
import { BRIDGE_ADDRESS, SEP_NET_ID, SEP_OWN_UPGR_TST_ADDRESS, SEP_TNFT_ADDRESS, SEP_TST_ADDRESS, SEP_UPGR_TST_ADDRESS, ZCHAIN_TST_ADDRESS } from "./helpers/constants";
import { MockERC20Upgradeable, MockERC20Upgradeable__factory, PolygonZkEVMBridgeV2, PolygonZkEVMBridgeV2__factory } from "../../typechain";


// Call to "bridgeAsset" using the Polygon ZKEVM Bridge for either Sepolia or ZChain
async function main() {
  const [userD, userE] = await hre.ethers.getSigners();

  const bridge = new PolygonZkEVMBridgeV2__factory(userD).attach(BRIDGE_ADDRESS) as unknown as PolygonZkEVMBridgeV2;

  const factory = await hre.ethers.getContractFactory("MockERC20Upgradeable");
  const token = await factory.attach(ZCHAIN_TST_ADDRESS) as MockERC20Upgradeable;

  const amount = hre.ethers.parseEther("1");

  // // Always fund user with enough to transfer
  // await token.mint(userE.address, amount);

  // Allow the bridge to spend transferred amount
  // await token.connect(userE).approve(BRIDGE_ADDRESS, amount);

  const zchainId = 1

  /** function args
   *  uint32 destinationNetwork,
      address destinationAddress,
      uint256 amount,
      address token,
      bool forceUpdateGlobalExitRoot,
      bytes calldata permitData
   */

  try {
    const tx = await bridge.connect(userE).bridgeAsset(
      SEP_NET_ID,
      userE.address,
      amount,
      await token.getAddress(),
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