import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import {
  MockERC20,
  MockERC721,
  Staking,
} from "../typechain";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import {
  StakingConfig,
} from "./helpers/staking/types";

describe("Staking", () => {
  let deployer : SignerWithAddress;
  let staker : SignerWithAddress;

  let stakingContract : Staking;

  let mockERC20 : MockERC20;
  let mockERC721 : MockERC721;

  let config : StakingConfig;
  let tokenId : number;

  before(async () => {
    [
      deployer,
      staker,
    ] = await hre.ethers.getSigners();

    const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    mockERC20 = await mockERC20Factory.deploy("MEOW", "MEOW");

    const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");
    mockERC721 = await mockERC721Factory.deploy("WilderWheels", "WW", "0://wheels-base");

    config = {
      stakingToken: await mockERC721.getAddress(),
      rewardsToken: await mockERC20.getAddress(),
      rewardsPerBlock: hre.ethers.parseEther("100").toString(),
    };

    const stakingFactory = await hre.ethers.getContractFactory("Staking");
    stakingContract = await stakingFactory.deploy("StakingNFT", "SNFT", config);

    // Give staking contract balance to pay rewards (maybe house these in a vault of some kind)
    await mockERC20.connect(deployer).transfer(await stakingContract.getAddress(), hre.ethers.parseEther("1000000"));

    tokenId = 1;
  });

  it("Can stake an NFT", async () => {
    await mockERC721.connect(deployer).mint(staker.address, tokenId);

    await mockERC721.connect(staker).approve(await stakingContract.getAddress(), tokenId);

    await stakingContract.connect(staker).stake(tokenId);

    // User has staked their NFT and gained an SNFT
    expect(await mockERC721.balanceOf(staker.address)).to.eq(0);
    expect(await stakingContract.balanceOf(staker.address)).to.eq(1);
  });

  it("Can claim rewards on a staked token", async () => {
    const blocks = 10;
    await mine(blocks);

    const balanceBefore = await mockERC20.balanceOf(staker.address);

    await stakingContract.connect(staker).claim(tokenId);

    const rewardsPerBlock = (await stakingContract.config()).rewardsPerBlock;

    const balanceAfter = await mockERC20.balanceOf(staker.address);

    // We do blocks + 1 because the claim call is executed on a new block in testing
    expect(balanceAfter).to.eq(balanceBefore + (rewardsPerBlock * BigInt(blocks + 1)));
  });

  it("Can unstake a token", async () => {
    const blocks = 10;
    await mine(blocks);

    const balanceBefore = await mockERC20.balanceOf(staker.address);

    await stakingContract.connect(staker).unstake(tokenId);

    const rewardsPerBlock = (await stakingContract.config()).rewardsPerBlock;

    const balanceAfter = await mockERC20.balanceOf(staker.address);

    // We do blocks + 1 because the unstake call is executed on a new block in testing
    expect(balanceAfter).to.eq(balanceBefore + (rewardsPerBlock * BigInt(blocks + 1)));
  });
});