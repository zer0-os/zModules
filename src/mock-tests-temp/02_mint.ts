import * as hre from "hardhat";
import { TestMockERC20, TestMockERC20__factory } from "../../typechain";
import assert from "assert";


const addr = "0xbafF8973Df466a7F620068a53975311EB31E931c";

const mint = async () => {
  const [ minter, receiver ] = await hre.ethers.getSigners();

  const factory = new TestMockERC20__factory(minter);
  const contract = factory.attach(addr) as TestMockERC20;

  const receiverBalanceBefore = await contract.balanceOf(receiver.address);

  const mintAmt = hre.ethers.parseEther("731");

  const tx = await contract.connect(minter).mint(
    receiver.address,
    mintAmt
  );

  await tx.wait(2);
  console.log("tx hash: ", tx.hash);

  console.log("Minted ", mintAmt.toString(), " to ", receiver.address);

  const receiverBalanceAfter = await contract.balanceOf(receiver.address);

  assert.equal(receiverBalanceAfter - receiverBalanceBefore, mintAmt);

  console.log("receiver balance before: ", receiverBalanceBefore.toString());
  console.log("receiver balance after: ", receiverBalanceAfter.toString());

  const tokenTotalSupply = await contract.totalSupply();

  assert.equal(tokenTotalSupply, mintAmt + hre.ethers.parseEther("10"));

  console.log("Total supply: ", tokenTotalSupply.toString());
};

mint()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
