import * as hre from "hardhat";

import { DEFAULT_STAKE } from "./constants";
import { getStakingERC20, getToken } from "./helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const token = getToken(userD);
  const contract = getStakingERC20(userD);

  const allowance = await token.allowance(userD.address, await contract.getAddress());

  if (allowance < DEFAULT_STAKE) {
    // Approve contract to spend funds on staker's behalf
    let tx = await token.connect(userD).approve(await contract.getAddress(), DEFAULT_STAKE);
    await tx.wait();
  }

  await contract.connect(userD).stakeWithoutLock(DEFAULT_STAKE);

  console.log(`Successfully staked: ${DEFAULT_STAKE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});