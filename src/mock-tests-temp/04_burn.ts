import * as hre from "hardhat";
import { TestMockERC20, TestMockERC20__factory } from "../../typechain";

// 4. Burn tokens from 2 different addresses

// TODO add when deployed
const addr = "";

async function main() {
  const [owner, holderA, holderB] = await hre.ethers.getSigners();

  const factory = new TestMockERC20__factory(owner);
  const contract = await factory.attach(addr) as TestMockERC20;

  const balanceBeforeA = await contract.balanceOf(holderA.address);
  const balanceBeforeB = await contract.balanceOf(holderB.address);

  const txA = await contract.connect(owner).burn(holderA.address, hre.ethers.parseEther("0.5"));

  const receiptA = await txA.wait();
  console.log("txA hash: ", receiptA?.hash);

  const txB = await contract.connect(owner).burn(holderB.address, hre.ethers.parseEther("0.5"));
  const receiptB = await txB.wait();
  console.log("txB hash: ", receiptB?.hash);

  const balanceAfterA = await contract.balanceOf(holderA.address);
  const balanceAfterB = await contract.balanceOf(holderB.address);

  console.log("holderA balance before: ", balanceBeforeA.toString());
  console.log("holderA balance after: ", balanceAfterA.toString());

  console.log("holderB balance before: ", balanceBeforeB.toString());
  console.log("holderA balance after: ", balanceAfterB.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});