import * as hre from "hardhat";

import {
  MockERC20,
  MockERC20__factory,
} from "../typechain";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const factory = new MockERC20__factory(userD);

  const token = await factory.deploy("TestToken", "TST") as MockERC20;

  await token.waitForDeployment();

  console.log(`Token successfully deployed to: ${await token.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});