import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import {
  MockERC20,
  MockERC721,
  Staking721,
} from "../typechain";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  PoolConfig,
} from "./helpers/staking/types";
import {
  dayInSeconds,
  unmintedTokenId,
} from "./helpers/staking/constants";
import { INVALID_TOKEN_ID, ONLY_NFT_OWNER } from "./helpers/staking/errors";
import { mock } from "node:test";

describe("Staking721", () => {
  let deployer : SignerWithAddress;
  let staker : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let staking721 : Staking721;

  let mockERC20 : MockERC20;
  let mockERC721 : MockERC721;

  let config : PoolConfig;
  let tokenId : number;


  before(async () => {
    [
      deployer,
      staker,
      notStaker
    ] = await hre.ethers.getSigners();

    const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    mockERC20 = await mockERC20Factory.deploy("MEOW", "MEOW");

    const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");
    mockERC721 = await mockERC721Factory.deploy("WilderWheels", "WW", "0://wheels-base");

    config = {
      stakingToken: await mockERC721.getAddress(),
      rewardsToken: await mockERC20.getAddress(),
      rewardsPeriod: BigInt(7), // a single rewards period is 7 days
      rewardsPerPeriod: hre.ethers.parseEther("5"),
      rewardsFraction: BigInt(0), // Not used in 721 rewards calcs
      timeLockPeriods: BigInt(1), // 1 period time lock
    };

    const stakingFactory = await hre.ethers.getContractFactory("Staking721");
    staking721 = await stakingFactory.deploy(
      "StakingNFT",
      "SNFT",
      config
    ) as Staking721;

    const funds = "9000000000000";

    // Approve the staking contract to distribute rewards
    await mockERC20.connect(deployer).approve(
      await staking721.getAddress(),
      hre.ethers.MaxUint256
    );

    // Give staking contract balance to pay rewards (maybe house these in a vault of some kind)
    await mockERC20.connect(deployer).transfer(
      await staking721.getAddress(),
      hre.ethers.parseEther(funds)
    );

    // Default token id
    tokenId = 1;
    await mockERC721.connect(deployer).mint(staker.address, tokenId);
    await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenId);
  });

  // Cases:
  // can stake more than once
  // can claim rewards after multiple stakes and get the appropriate amount of rewards

  describe("#stake", () => {
    it("Can stake an NFT", async () => {  
      await staking721.connect(staker).stake(tokenId);
  
      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(staker.address)).to.eq(0);
      expect(await staking721.balanceOf(staker.address)).to.eq(1);
    });
  
    it("Fails to stake when the token id is invalid", async () => {
      // No new token is created, so id is invalid
      await expect(staking721.connect(staker).stake(unmintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  
    it("Fails to stake when the token is already staked", async () => {
      // If the token is staked, the owner will be the staking contract not the original owner
      await expect(
        staking721.connect(staker).stake(tokenId)
      ).to.be.revertedWithCustomError(staking721, "InvalidOwner");  
    });
  
    it("Fails to stake when the caller is not the owner of the NFT", async () => {
      // Deployer has new token
      await mockERC721.connect(deployer).mint(deployer.address, tokenId + 1);
  
      await mockERC721.connect(deployer).approve(await staking721.getAddress(), tokenId + 1);
  
      // Staker does not own the newly minted token and cannot stake it
      await expect(staking721.connect(staker).stake(tokenId + 1)).to.be.revertedWithCustomError(staking721, "InvalidOwner");
    });
  })

  describe("#claim", () => {
    it("Can claim rewards on a staked token", async () => {
      // Move forward in time one period to be able to claim
      await time.increase(dayInSeconds * config.rewardsPeriod);
  
      const balanceBefore = await mockERC20.balanceOf(staker.address);
  
      await staking721.connect(staker).claim(tokenId);
  
      const balanceAfter = await mockERC20.balanceOf(staker.address);
      
      // One period has passed, expect that rewards for one period were given
      expect(balanceAfter).to.eq(balanceBefore + config.rewardsPerPeriod);
    });

    it ("Fails to claim when not enough time has passed", async () => {
      await time.increase(dayInSeconds * (config.rewardsPeriod - 1n));
  
      await expect(staking721.connect(staker).claim(tokenId)).to.be.revertedWithCustomError(staking721, "InvalidClaim")
    });

    it ("Fails to claim when the token ID is invalid", async () => {
      // No new token is created, so id is invalid
      await expect(staking721.connect(staker).claim(unmintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to claim when the caller is not the owner of the SNFT", async () => {
      await expect(staking721.connect(notStaker).claim(tokenId)).to.be.revertedWithCustomError(staking721, "InvalidOwner")
    });
    
    it("Fails to claim when the token ID is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist
      await expect(staking721.connect(staker).claim(tokenId + 2)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  });

  describe("#unstake", () => {
    it("Can unstake a token", async () => {
      // Move forward in time one period to be able to claim
      await time.increase(dayInSeconds * config.rewardsPeriod);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await staking721.connect(staker).unstake(tokenId);

      const balanceAfter = await mockERC20.balanceOf(staker.address);

      // One period has passed, expect that rewards for one period were given
      expect(balanceAfter).to.eq(balanceBefore + config.rewardsPerPeriod);
      
      // User has regained their NFT and the SNFT was burned
      expect(await mockERC721.balanceOf(staker.address)).to.eq(1);
      expect(await staking721.balanceOf(staker.address)).to.eq(0);
      await expect(staking721.ownerOf(tokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to unstake when not enough time has passed", async () => {
      // Restake to be able to unstake
      await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenId);
      await staking721.connect(staker).stake(tokenId);

      await time.increase(dayInSeconds * (config.rewardsPeriod - 1n));

      await expect(staking721.connect(staker).unstake(tokenId)).to.be.revertedWithCustomError(staking721, "InvalidClaim");
    });

    it("Fails when token id is invalid", async () => {
      await expect(staking721.connect(staker).unstake(unmintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails when caller is not the owner of the SNFT", async () => {
      await expect(staking721.connect(notStaker).unstake(tokenId)).to.be.revertedWithCustomError(staking721, "InvalidOwner");
    });

    it("Fails when token id is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist and so we can't unstake it
      await expect(staking721.connect(staker).unstake(tokenId + 2)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  });
});