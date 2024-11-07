import * as hre from "hardhat";

import {
  MockERC20,
  MockERC20__factory,
  MockERC721__factory,
} from "../typechain";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const factory = new MockERC721__factory(userD);

  const token = await factory.deploy("TestNFT", "TNFT", "0://baseuri");

  await token.waitForDeployment();

  console.log(`Token successfully deployed to: ${await token.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});