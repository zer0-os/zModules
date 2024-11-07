import * as hre from "hardhat";

async function main() {
  const [userD] = await hre.ethers.getSigners();

  const factory = await hre.ethers.getContractFactory("MockERC20Upgradeable");

  const tx = await hre.upgrades.deployProxy(factory, ["TestToken", "TST"], {
    initializer: "initialize",
  });

  const receipt = await tx.waitForDeployment();

  console.log(receipt)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});