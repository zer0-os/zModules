import * as hre from "hardhat";

import { MockOwned, MockOwned__factory } from "../typechain";

// Compromised wallet addresses
// const walletA = "0x7829Afa127494Ca8b4ceEF4fb81B78fEE9d0e471"
// const walletB = "0x37358Aa5D051B434C23Bad744E56E6A484107272"
// const walletC = "0xa75587029b13632dda5dc40711ebdfc5ddc6bfb5"
// const walletD = "0x6584A486F711eB8aC47aBf78A5C8e218Ee758fa9"

// to check manually
const contractAddress = "0x8E4C057032436498817de977Dc1aE10e3Dfd23c1"

async function main() {
  const [userD, deployer] = await hre.ethers.getSigners();

  // We mock an ownable contract just to have the interface to call `owner`
  const factory = new MockOwned__factory(userD);
  const ownableContract = new hre.ethers.Contract(contractAddress, factory.interface, userD) as unknown as MockOwned;

  const tx = await ownableContract.connect(deployer).renounceOwnership();
  const receipt = await tx.wait();

  console.log(receipt?.hash)
  // console.log(owner)

  // const proxyAdmin = await hre.upgrades.erc1967.getAdminAddress(contractAddress);
  // console.log(proxyAdmin)

  // console.log(receipt?.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});