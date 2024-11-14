import * as hre from "hardhat";

import { DEFAULT_STAKE } from "../../helpers/constants";
import { getStakingERC20, getERC20 } from "../../helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const token = getERC20(userD);
  const contract = getStakingERC20(userD);

  const allowance = await token.allowance(userD.address, await contract.getAddress());

  const stakeAmount = DEFAULT_STAKE;

  if (allowance < stakeAmount) {
    // Approve contract to spend funds on staker's behalf
    const tx = await token.connect(userD).approve(await contract.getAddress(), DEFAULT_STAKE);
    await tx.wait();
  }

  try {
    const tx = await contract.connect(userD).stake(
      stakeAmount, 
      {
        gasLimit: 500000
      }
    );

    const receipt = await tx.wait();

    console.log(receipt);
  } catch(e) {
    console.log(e);
  }

  console.log(`Successfully staked: ${DEFAULT_STAKE}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});