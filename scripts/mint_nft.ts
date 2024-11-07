import * as hre from "hardhat";

import { getERC721Token, getStakingERC20, getToken } from "./helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const token = getERC721Token(userD);

  const tokenId = 1;

  const tx = await token.connect(userD).mint(userD.address, tokenId);
  await tx.wait();

  console.log(`Successfully minted NFT: ${tokenId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});