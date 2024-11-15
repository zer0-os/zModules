import * as hre from "hardhat";

import { getStakingERC20, getERC20, getERC20Upgradeable } from "../../helpers";

async function main() {
  const [userD, userE] = await hre.ethers.getSigners();

  const token = await getERC20(userD);
  const rewardToken = await getERC20Upgradeable(userD);
  const contract = await getStakingERC20(userD);

  const balanceOfContractBefore = await rewardToken.balanceOf(await contract.getAddress());

  const pendingRewards = await contract.connect(userD).getPendingRewards();
  const amountStaked = (await contract.connect(userD).stakers(userD.address)).amountStaked;
  console.log(amountStaked)
  // if (balanceOfContractBefore < pendingRewards) {
  //   await rewardToken.connect(userD).mint(await contract.getAddress(), pendingRewards * 2n);
  // }

  // await contract.connect(userD).unstake(amountStaked, true);

  // const amountStakedAfter = (await contract.connect(userD).stakers(userD.address)).amountStaked;

  // console.log("amountStaked", amountStaked);
  // console.log("amountStakedAfter", amountStakedAfter);

  // console.log(`Exited with: ${amountStaked}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});