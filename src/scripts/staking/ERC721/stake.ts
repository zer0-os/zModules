import * as hre from "hardhat";

import { DEFAULT_STAKE } from "../../helpers/constants";
import { getStakingERC20, getERC20, getERC721, getStakingERC721 } from "../../helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const token = await getERC721(userD);
  const contract = getStakingERC721(userD);

  const tokenId = 1;

  await token.connect(userD).approve(await contract.getAddress(), tokenId);

  const amountStakedBefore = (await contract.connect(userD).stakers(userD.address)).amountStaked;
  console.log("Before staking: ", amountStakedBefore);

  try {
    const tx = await contract.connect(userD).stake(
      [tokenId],
      ["token1"],
      {
        gasLimit: 500000
      }
    );

    const receipt = await tx.wait();

    console.log(receipt?.hash);
  } catch(e) {
    console.log(e);
  }

  console.log(`Successfully staked ERC721: ${tokenId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});