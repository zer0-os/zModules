import * as hre from "hardhat";

import {
  MockERC20,
  MockERC20__factory,
  MockERC721__factory,
} from "../typechain";
import { deployContract } from "./helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  await deployContract(new MockERC20__factory(userD), ["TestToken", "TST"]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});