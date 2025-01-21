import * as hre from "hardhat";

import { MockOwned, MockOwned__factory } from "../typechain";
import { allAddresses } from "./allAddresses";
import { crossReferenceOwners } from "./crossReferenceOwners";
import { crossReferenceProxyAdmins } from "./crossReferenceProxyAdmins";
import { crossReferenceProxyAdminOwners } from "./crossReferenceProxyAdminOwners";

// Compromised wallet addresses
const walletA = "0x7829Afa127494Ca8b4ceEF4fb81B78fEE9d0e471"
const walletB = "0x37358Aa5D051B434C23Bad744E56E6A484107272"
const walletC = "0xa75587029b13632dda5dc40711ebdfc5ddc6bfb5"
const walletD = "0x6584A486F711eB8aC47aBf78A5C8e218Ee758fa9"

async function main() {
  const [userD] = await hre.ethers.getSigners();

  let count = 0;
  let countCanFix = 0;

  for (let i = 0; i < allAddresses.length; i++) {
    const addr = allAddresses[i];

    // To avoid infura rate limits we wait in between each loop
    setTimeout(() => {
      console.log(`Checking ${addr}`);
    }, 1000);

    // First we see if it is a proxy
    // then check if proxy admin, then check owner of admin
    // then check if contract itself is ownable
    // if owning wallet is compromised, can we take action?

    const factory = new MockOwned__factory(userD);
    const proxyAdmin = await hre.upgrades.erc1967.getAdminAddress(addr);

    // If zero address, empty string or "none" skip (account for data inconsistency)
    // if non-zero, we investigate further
    if (proxyAdmin !== hre.ethers.ZeroAddress) {
      const adminCrossRef = crossReferenceProxyAdmins[i];

      if (
        proxyAdmin !== hre.ethers.ZeroAddress
        && proxyAdmin.toLowerCase() !== adminCrossRef.toLowerCase()
      ) {
        if (adminCrossRef !== "" && adminCrossRef !== "none") {
          console.log("\nERROR: ProxyAdmin mismatch")
          console.log(`${proxyAdmin} !== ${adminCrossRef}`)
          console.log(`For contract: ${addr}\n`)
        }
      }

      // Get the owner of the proxy admin
      const proxyAdminContract = new hre.ethers.Contract(proxyAdmin, factory.interface, userD) as unknown as MockOwned;
      const adminOwner = await proxyAdminContract.owner();

      let adminOwnerCrossRef = crossReferenceProxyAdminOwners[i];

      if (
        adminOwner !== hre.ethers.ZeroAddress
        && adminOwner.toLowerCase() !== adminOwnerCrossRef.toLowerCase()
      ) {
        console.log("\nERROR: ProxyAdmin Owner mismatch")
        console.log(`${adminOwner} !== ${adminOwnerCrossRef}`)
        console.log(`For ProxyAdmin: ${proxyAdmin}`)
        console.log(`For contract: ${addr}\n`)
      }

      if (adminOwner.toLowerCase() !== hre.ethers.ZeroAddress.toLowerCase()) {
        if (
          adminOwner === walletA ||
          adminOwner === walletB ||
          adminOwner === walletC ||
          adminOwner === walletD
        ) {
          count++;
          console.log("\nProxyAdmin Owner is a compromised wallet !!!")
          console.log(`ProxyAdmin Owner: ${adminOwner}`);
          console.log(`For ProxyAdmin: ${proxyAdmin}`)
          console.log(`For contract: ${addr}`)


          if (adminOwner === walletA || adminOwner === walletB) {
            countCanFix++;
            console.log("ProxyAdmin Owner is a wallet we DO control\n")
          } else {
            console.log("ProxyAdmin Owner is a wallet we DO NOT control\n")

          }
        }
      }
    }

    // Check contract owner
    const contract = new hre.ethers.Contract(addr, factory.interface, userD) as unknown as MockOwned;
    try {
      const owner = await contract.connect(userD).owner();

      const ownerCrossRef = crossReferenceOwners[i];

      if (owner.toLowerCase() !== ownerCrossRef.toLowerCase()) {
        if (owner !== hre.ethers.ZeroAddress) {
          console.log("\nERROR: Owner mismatch")
          console.log(`${owner} !== ${ownerCrossRef}`)
          console.log(`For contract: ${addr}\n`)
        }
      }

      if (owner !== hre.ethers.ZeroAddress) {
        if (
          owner === walletA ||
          owner === walletB ||
          owner === walletC ||
          owner === walletD
        ) {
          count++;
          console.log("\nOwner is a compromised wallet!!!")
          console.log(`Owner: ${owner}`);
          console.log(`For contract: ${addr}`)

          if (owner === walletA || owner === walletB) {
            countCanFix++;
            console.log(`Address: ${addr}`);
            console.log("Owner is a wallet we DO control\n")
          } else {
            console.log("Owner is a wallet we DO NOT control\n")
          }
        }
      }
    } catch (error) {
      // Contract does not have "owner" property to check, skipping
    }
  };

  console.log(`Compromised contracts: ${count}`);
  console.log(`Can fix: ${countCanFix}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});