import * as hre from "hardhat";

import { MockOwned, MockOwned__factory } from "../typechain";

// Compromised wallet addresses
// const walletA = "0x7829Afa127494Ca8b4ceEF4fb81B78fEE9d0e471"
// const walletB = "0x37358Aa5D051B434C23Bad744E56E6A484107272"
// const walletC = "0xa75587029b13632dda5dc40711ebdfc5ddc6bfb5"
// const walletD = "0x6584A486F711eB8aC47aBf78A5C8e218Ee758fa9"

// to check manually
const contractAddress = "0x7bA5faff747a3cA7E4ebe65F64e3EDFAEE136846"

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const proxyAdmin = await hre.upgrades.erc1967.getAdminAddress(contractAddress);

  // We mock an ownable contract just to have the interface to call `owner`
  const factory = new MockOwned__factory(userD);
  const proxyAdminContract = new hre.ethers.Contract(proxyAdmin, factory.interface, userD) as unknown as MockOwned;
  
  let proxyAdminOwner = "Contract is not a proxy"
  if (proxyAdmin !== hre.ethers.ZeroAddress) {
    proxyAdminOwner = await proxyAdminContract.owner();
  }

  // get contract instance to call owner as well
  const contract = new hre.ethers.Contract(contractAddress, factory.interface, userD) as unknown as MockOwned;
  let contractOwner;
  try {
    contractOwner = await contract.owner();
  } catch (e) {
    contractOwner = "Contract is not `Ownable`";
  }

  console.log(`Contract: ${contractAddress}`);
  console.log(`Contract owner: ${contractOwner}`)
  console.log(`ProxyAdmin: ${proxyAdmin}`);
  console.log(`ProxyAdmin owner: ${proxyAdminOwner}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});