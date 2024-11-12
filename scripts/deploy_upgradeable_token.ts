import * as hre from "hardhat";
import { deployUpgradeableContract } from "./helpers";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const factory = await hre.ethers.getContractFactory("MockERC20Upgradeable");

  const tx = await hre.upgrades.deployProxy(factory, ["TestToken", "TST", userD.address], {
    initializer: "initialize",
    kind: "transparent",
  });

  const receipt = await tx.waitForDeployment();

  console.log(receipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});