import * as hre from "hardhat";

import { getStakingERC20, getStakingERC721 } from "../../helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();
  const contract = getStakingERC721(userD);

  const stakerData = await contract.connect(userD).stakers(userD.address);

  console.log(stakerData.amountStaked.toString());
  console.log(stakerData.lastUpdatedTimestamp.toString());

  const remainingTime = await contract.connect(userD).getRemainingLockTime();
  console.log(remainingTime);

  console.log(`Pending rewards: ${await contract.connect(userD).getPendingRewards()}`);;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});