import * as hre from "hardhat";

import { getStakingERC20, getERC20 } from "../../helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const token = getERC20(userD);
  const contract = getStakingERC20(userD);

  const balanceOfContractBefore = await token.balanceOf(await contract.getAddress());

  if (balanceOfContractBefore > 0n) {
    
    await contract.connect(userD).exit();

    const balanceOfContractAfter = await token.balanceOf(await contract.getAddress());

    console.log(`Exited with: ${balanceOfContractBefore - balanceOfContractAfter}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});