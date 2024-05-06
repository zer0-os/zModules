const hre = require("hardhat");

import { Counter__factory } from "../typechain";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const factory = new Counter__factory(deployer);

  const contract = await factory.deploy();

  await contract.waitForDeployment();

  console.log("Counter deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});