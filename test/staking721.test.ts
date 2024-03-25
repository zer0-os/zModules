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
import { createDefaultConfigs } from "./helpers/staking/defaults";
import { calcRewardsAmount } from "./helpers/staking/rewards";

describe("Staking721", () => {
  let deployer : SignerWithAddress;
  let staker : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let staking721 : Staking721;

  let mockERC20 : MockERC20;
  let mockERC721 : MockERC721;

  let config : PoolConfig;
  let tokenId : number;

  let stakeTime : number;
  let claimTime : number;
  let unstakeTime : number;


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

    config = await createDefaultConfigs(mockERC20, mockERC721);

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

      // Log for claim and unstake test
      stakeTime = await time.latest();

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(staker.address)).to.eq(0);
      expect(await staking721.balanceOf(staker.address)).to.eq(1);
    });

    it("Can stake multiple NFTs", async () => {
      const tokenId2 = 2;
      const tokenId3 = 3;

      await mockERC721.connect(deployer).mint(staker.address, tokenId2);
      await mockERC721.connect(deployer).mint(staker.address, tokenId3);

      await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenId2);
      await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenId3);

      const balanceBefore = await mockERC721.balanceOf(staker.address);
      const balanceBeforeSNFT = await staking721.balanceOf(staker.address);

      // Stake multiple 
      await staking721.connect(staker).stakeBulk([tokenId2, tokenId3]);

      const balanceAfter = await mockERC721.balanceOf(staker.address);
      const balanceAfterSNFT = await staking721.balanceOf(staker.address);

      expect(balanceAfter).to.eq(balanceBefore - 2n);
      expect(balanceAfterSNFT).to.eq(balanceBeforeSNFT + 2n);

      // Reset state
      await staking721.connect(staker).removeStakeBulk([tokenId2, tokenId3]);
      
      // Burn
      await mockERC721.connect(deployer).burn(tokenId2);
      await mockERC721.connect(deployer).burn(tokenId3);
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
      const tokenId2 = 2;
      await mockERC721.connect(deployer).mint(deployer.address, tokenId2);
  
      await mockERC721.connect(deployer).approve(await staking721.getAddress(), tokenId2);
  
      // Staker does not own the newly minted token and cannot stake it
      await expect(staking721.connect(staker).stake(tokenId2)).to.be.revertedWithCustomError(staking721, "InvalidOwner");

      // Reset
      await mockERC721.connect(deployer).burn(tokenId2);
    });
  })

  describe("#claim", () => {
    it("Can claim rewards on a staked token", async () => {
      // Move forward in time one period to be able to claim
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await staking721.connect(staker).claim(tokenId);

      claimTime = await time.latest();
      
      const expectedRewards = calcRewardsAmount(config, BigInt(1), BigInt(claimTime - stakeTime));
  
      const balanceAfter = await mockERC20.balanceOf(staker.address);
      
      // One period has passed, expect that rewards for one period were given
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
    });

    it ("Fails to claim when not enough time has passed", async () => {
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
      // Restake to be able to unstake again
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

      // To reset state, we unstake here
      await time.increase(dayInSeconds * (config.rewardsPeriod));
      await staking721.connect(staker).unstake(tokenId);
    });
  });

  describe("#removeStake | #removeStakeBulk", () => {
    it("Allows the user to remove their stake within the timelock period without rewards", async () => {
      // Token is already staked from `Fails to unstake when not enough time has passed` test above
      await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenId);
      await staking721.connect(staker).stake(tokenId);

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(staker.address)).to.eq(0);
      expect(await staking721.balanceOf(staker.address)).to.eq(1);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await staking721.connect(staker).removeStake(tokenId);

      const balanceAfter = await mockERC20.balanceOf(staker.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(staker.address)).to.eq(1);
      expect(await staking721.balanceOf(staker.address)).to.eq(0);
    });

    // TODO cases
    // fails when not owner of sNFT
    // fails when token id is invalid
    // fails when token id is not staked (snft does not exist)

    it("Allows the user to remove multiple stakes within the timelock period without rewards", async () => {
      const tokenId2 = 2;
      const tokenId3 = 3;

      // Mint extra tokens
      await mockERC721.connect(deployer).mint(staker.address, tokenId2);
      await mockERC721.connect(deployer).mint(staker.address, tokenId3);

      // Approve all
      await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenId);
      await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenId2);
      await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenId3);

      // Stake multiple
      await staking721.connect(staker).stakeBulk([tokenId, tokenId2, tokenId3]);

      expect(await mockERC721.balanceOf(staker.address)).to.eq(0);
      expect(await staking721.balanceOf(staker.address)).to.eq(3);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      // Verify we can remove multiple stakes in a single tx
      await staking721.connect(staker).removeStakeBulk([tokenId, tokenId2, tokenId3]);

      const balanceAfter = await mockERC20.balanceOf(staker.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(staker.address)).to.eq(3);
      expect(await staking721.balanceOf(staker.address)).to.eq(0);
    });
  });
});