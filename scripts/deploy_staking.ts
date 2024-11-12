import * as hre from "hardhat";

import {
  StakingERC20,
  StakingERC20__factory,
} from "../typechain";
import { ZCHAIN_TST_ADDRESS } from "./helpers/constants";
import { deployContract } from "./helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const factory = new StakingERC20__factory(userD);

  const contract = await factory.deploy(
    ZCHAIN_TST_ADDRESS,
    ZCHAIN_TST_ADDRESS,
    100,
    userD.address

  ) as StakingERC20;

  await contract.waitForDeployment();

  console.log(`Staking contract successfully deployed to: ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});