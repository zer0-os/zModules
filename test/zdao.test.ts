import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


describe("zDAO Smoke Test", () => {
  let admin : SignerWithAddress;
  let user1 : SignerWithAddress;

  before(async () => {
    [admin, user1] = await hre.ethers.getSigners();

    const nftFact = await hre.ethers.getContractFactory("VotingERC721Mock");
    const nft = await nftFact.deploy() as VotingERC721Mock;

    const erc20Fact = await hre.ethers.getContractFactory("VotingERC20Mock");
    const erc20 = await erc20Fact.deploy();

    const timelockFact = await hre.ethers.getContractFactory("TimelockController");
    const timelock = await timelockFact.deploy(1, [], [], admin.address);

    await nft.mint(admin.address, 1);
  });
});
