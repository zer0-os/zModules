
// 3. Transfer from this address to another address

import * as hre from "hardhat";

import { TestMockERC20, TestMockERC20__factory } from "../../typechain";

// TODO add when deployed
const addr = "";

async function main() {
  const [sender, receiver] = await hre.ethers.getSigners();

  const factory = new TestMockERC20__factory(sender);
  const contract = await factory.attach(addr) as TestMockERC20;

  const balanceBefore = await contract.balanceOf(sender.address);
  const receiverBalanceBefore = await contract.balanceOf(receiver.address);

  const tx = await contract.connect(sender).transfer(receiver.address, hre.ethers.parseEther("1"));
  const receipt = await tx.wait();

  console.log("tx hash: ", receipt?.hash);

  const balanceAfter = await contract.balanceOf(sender.address);
  const receiverBalanceAfter = await contract.balanceOf(receiver.address);

  console.log("sender balance before: ", balanceBefore.toString());
  console.log("sender balance after: ", balanceAfter.toString());

  console.log("receiver balance before: ", receiverBalanceBefore.toString());
  console.log("receiver balance after: ", receiverBalanceAfter.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});