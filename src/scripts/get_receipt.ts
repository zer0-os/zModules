
// https://wilderworld-dev-erigon1-blockscout.eu-north-2.gateway.fm/tx/0x98d479bae8a73cf12370181973a09f9e69ba124d3d60f417e837a142a98c504c


import * as hre from "hardhat";


import { getERC721 } from "./helpers";
// import { BRIDGE_ADDRESS, SEP_NET_ID, SEP_OWN_UPGR_TST_ADDRESS, SEP_TNFT_ADDRESS, SEP_TST_ADDRESS, SEP_UPGR_TST_ADDRESS, ZCHAIN_TST_ADDRESS } from "./helpers/constants";
// import { MockERC20Upgradeable, MockERC20Upgradeable__factory, PolygonZkEVMBridgeV2, PolygonZkEVMBridgeV2__factory } from "../../typechain";


// Call to "bridgeAsset" using the Polygon ZKEVM Bridge for either Sepolia or ZChain
async function main() {
  const [userD, userE] = await hre.ethers.getSigners();

  // failed tx from stake
  const txHash = "0x98d479bae8a73cf12370181973a09f9e69ba124d3d60f417e837a142a98c504c"
  // const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);

  const data = await hre.network.provider.send("debug_traceTransaction", [txHash,
    {
      disableMemory: true,
      disableStack: true,
      disableStorage: true,
    },
  ]);
  console.log(data);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});