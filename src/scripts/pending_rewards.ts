import * as hre from "hardhat";

import { getStakingERC20, getToken } from "./helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();
  const contract = getStakingERC20(userD);

  console.log(`Pending rewards: ${await contract.connect(userD).getPendingRewards()}`);;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});