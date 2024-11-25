import * as hre from "hardhat";

import { DEFAULT_STAKE } from "../../helpers/constants";
import { getStakingERC20, getERC20 } from "../../helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const token = await getERC20(userD);
  const contract = getStakingERC20(userD);

  const allowance = await token.allowance(userD.address, await contract.getAddress());

  const balance = await token.balanceOf(userD.address);
  console.log(balance.toString());

  const stakeAmount = DEFAULT_STAKE * 3n;

  if (allowance < stakeAmount) {
    console.log("calling to approve")
    // Approve contract to spend funds on staker's behalf
    const tx = await token.connect(userD).approve(await contract.getAddress(), stakeAmount);
    await tx.wait();
  }  

  const amountStakedBefore = (await contract.connect(userD).stakers(userD.address)).amountStaked;
  console.log("Before staking: ", amountStakedBefore);

  try {
    const tx = await contract.connect(userD).stake(
      stakeAmount, 
      {
        gasLimit: 500000
      }
    );

    const receipt = await tx.wait();

    console.log(receipt?.hash);
  } catch(e) {
    console.log(e);
  }

  console.log(`Successfully staked: ${DEFAULT_STAKE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});