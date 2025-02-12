
// 3. Transfer from this address to another address

import * as hre from "hardhat";

import { TestMockERC20, TestMockERC20__factory } from "../../typechain";

const addr = "0xbafF8973Df466a7F620068a53975311EB31E931c";

const main = async () => {
  const [receiver, sender] = await hre.ethers.getSigners();

  const factory = new TestMockERC20__factory(sender);
  const contract = factory.attach(addr) as TestMockERC20;

  const balanceBefore = await contract.balanceOf(sender.address);
  const receiverBalanceBefore = await contract.balanceOf(receiver.address);

  const transferAmt = hre.ethers.parseEther("13");

  const tx = await contract.connect(sender).transfer(receiver.address, transferAmt);
  const receipt = await tx.wait(2);

  console.log("tx hash: ", receipt?.hash);

  const balanceAfter = await contract.balanceOf(sender.address);
  const receiverBalanceAfter = await contract.balanceOf(receiver.address);

  console.log("sender balance before: ", balanceBefore.toString());
  console.log("sender balance after: ", balanceAfter.toString());

  console.log("receiver balance before: ", receiverBalanceBefore.toString());
  console.log("receiver balance after: ", receiverBalanceAfter.toString());
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
