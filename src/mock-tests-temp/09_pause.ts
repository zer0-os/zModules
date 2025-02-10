import * as hre from "hardhat";
import { TestMockERC20, TestMockERC20__factory } from "../../typechain";

// 9. Pause the contract from the owner address

// TODO add when deployed
const addr = "";

async function main() {
  const [owner, holderA, holderB] = await hre.ethers.getSigners();

  const factory = new TestMockERC20__factory(owner);
  const contract = await factory.attach(addr) as TestMockERC20;

  console.log("Pause status: ", await contract.paused());

  const tx = await contract.connect(owner).pause();
  const receipt = await tx.wait();
  console.log("tx hash: ", receipt?.hash);

  console.log("Pause status after: ", await contract.paused());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});