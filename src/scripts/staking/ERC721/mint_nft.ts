import * as hre from "hardhat";

import { getERC721, getStakingERC20, getERC20 } from "../../helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const token = await getERC721(userD);

  const tokenId = 1;

  const tx = await token.connect(userD).mint(userD.address, tokenId);
  await tx.wait();

  console.log(`Successfully minted NFT: ${tokenId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});