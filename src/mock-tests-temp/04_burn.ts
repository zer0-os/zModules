import * as hre from "hardhat";
import { TestMockERC20, TestMockERC20__factory } from "../../typechain";

// 4. Burn tokens from 2 different addresses

const addr = "0xbafF8973Df466a7F620068a53975311EB31E931c";

const main = async () => {
  const [owner, holderA] = await hre.ethers.getSigners();

  const factory = new TestMockERC20__factory(owner);
  const contract = factory.attach(addr) as TestMockERC20;

  const balanceBeforeA = await contract.balanceOf(holderA.address);
  const balanceBeforeB = await contract.balanceOf(owner.address);

  const burnAmt1= hre.ethers.parseEther("3.759");

  const txA = await contract.connect(owner).burn(
    holderA.address,
    burnAmt1
  );

  const receiptA = await txA.wait();
  console.log("txA hash: ", receiptA?.hash);

  const txB = await contract.connect(owner).burn(
    owner.address,
    burnAmt1 * 2n
  );
  const receiptB = await txB.wait(2);
  console.log("txB hash: ", receiptB?.hash);

  const balanceAfterA = await contract.balanceOf(holderA.address);
  const balanceAfterB = await contract.balanceOf(owner.address);

  console.log("holderA balance before: ", balanceBeforeA.toString());
  console.log("holderA balance after: ", balanceAfterA.toString());

  console.log("holderB balance before: ", balanceBeforeB.toString());
  console.log("holderA balance after: ", balanceAfterB.toString());
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
