import * as hre from "hardhat";

import { getStakingERC20, getERC20, getERC20Upgradeable } from "../../helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const contract = getStakingERC20(userD);
  const rewardToken = await getERC20Upgradeable(userD);

  const balanceBefore = await rewardToken.balanceOf(await contract.getAddress());
  console.log(balanceBefore);

  const pendingRewards = await contract.connect(userD).getPendingRewards();
  console.log(pendingRewards)

  const remainingTime = await contract.connect(userD).getRemainingLockTime();
  console.log(remainingTime);

  const stakerData = await contract.connect(userD).stakers(userD.address);
  console.log(`Amount staked: ${stakerData.amountStaked}`);

  // Withdraw half
  // const amount = stakerData.amountStaked / 2n;

  // await rewardToken.connect(userD).mint(await contract.getAddress(), hre.ethers.parseEther("1111"));

  // try {
  //   const tx = await contract.connect(userD).unstake(
  //     amount,
  //     true,
  //     {
  //       nonce: 500, // idk actual nonce
  //       gasLimit: 500000
  //     }
  //   );

  //   const receipt = await tx.wait();

  //   console.log(receipt?.hash);
  // } catch(e) {
  //   console.log(e);
  // }

  // const stakerDataAfter = await contract.connect(userD).stakers(userD.address);
  // console.log(`Amount staked after: ${stakerDataAfter.amountStaked}`);

  // console.log(`Successfully unstaked: ${amount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});