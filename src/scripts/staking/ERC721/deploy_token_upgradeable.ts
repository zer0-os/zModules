import * as hre from "hardhat";

import {
  MockERC721Upgradeable,
  MockERC721Upgradeable__factory
} from "../../../../typechain";
import { ZCHAIN_TST_ADDRESS, ZCHAIN_UPGR_TST_ADDRESS } from "../../helpers/constants";
import { DAY_IN_SECONDS } from "../../../../test/helpers/constants";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const factory = new MockERC721Upgradeable__factory(userD); 

  const contract = await hre.upgrades.deployProxy(
    factory,
    [
      "TestNFT",
      "TNFT",
      "0://tnft/"
    ]
  ) as unknown as MockERC721Upgradeable;;

  await contract.waitForDeployment();

  console.log(`ERC721Upgradeable contract successfully deployed to: ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});