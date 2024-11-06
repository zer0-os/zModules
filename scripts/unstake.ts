import * as hre from "hardhat";

import { getStakingERC20, getToken } from "./helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const token = getToken(userD);
  const stakingContract = getStakingERC20(userD);

  const pendingRewards = await stakingContract.connect(userD).claim();
  console.log(`Claimed rewards: ${pendingRewards}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});