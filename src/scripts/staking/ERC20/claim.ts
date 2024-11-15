import * as hre from "hardhat";

import { getStakingERC20, getERC20, getERC20Upgradeable } from "../../helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const contract = getStakingERC20(userD);
  const rewardToken = await getERC20Upgradeable(userD);

  const contractBalance = await rewardToken.balanceOf(await contract.getAddress());
  console.log(contractBalance);

  const balanceBefore = await rewardToken.balanceOf(userD.address);
  console.log(balanceBefore);

  const pendingRewards = await contract.connect(userD).getPendingRewards();
  console.log(pendingRewards)

  const remainingTime = await contract.connect(userD).getRemainingLockTime();
  console.log(remainingTime);

  const stakerdata = await contract.connect(userD).stakers(userD.address);
  console.log(stakerdata.amountStaked);




  // await rewardToken.connect(userD).mint(await contract.getAddress(), hre.ethers.parseEther("3333"));

  try {
    const tx = await contract.connect(userD).claim(
      // {
      //   gasLimit: 500000
      // }
    );

    const receipt = await tx.wait();

    console.log(receipt);
  } catch(e) {
    console.log(e);
  }

  const balanceAfter = await rewardToken.balanceOf(userD.address);

  const diff = balanceAfter - balanceBefore;
  console.log(`Successfully claimed: ${diff}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});