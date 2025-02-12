import * as hre from "hardhat";
import { TestMockERC20, TestMockERC20__factory } from "../../typechain";

// 9. Pause the contract from the owner address

const addr = "0xbafF8973Df466a7F620068a53975311EB31E931c";

const main = async () => {
  const [owner] = await hre.ethers.getSigners();

  const factory = new TestMockERC20__factory(owner);
  const contract = factory.attach(addr) as TestMockERC20;

  console.log("Pause status: ", await contract.paused());

  const tx = await contract.connect(owner).pause();
  const receipt = await tx.wait(2);
  console.log("tx hash: ", receipt?.hash);

  console.log("Pause status after: ", await contract.paused());
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
