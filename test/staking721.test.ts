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
  
  // Default token ids
  const tokenIdA = 1;
  const tokenIdB = 2;
  const tokenIdC = 3;
  const nonStakedTokenId = 4; // Never used in `stake`
  const nonMintedTokenId = 5; // Never minted

  let stakedOrClaimedAtA : bigint;
  let stakedOrClaimedAtB : bigint;
  let stakedOrClaimedAtC : bigint;

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

    await mockERC721.connect(deployer).mint(staker.address, tokenIdA);
    await mockERC721.connect(deployer).mint(staker.address, tokenIdB);
    await mockERC721.connect(deployer).mint(staker.address, tokenIdC);
    await mockERC721.connect(deployer).mint(deployer.address, nonStakedTokenId);

    await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdA);
    await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdB);
    await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdC);
  });

  // Cases:
  // can stake more than once
  // can claim rewards after multiple stakes and get the appropriate amount of rewards

  describe("#stake", () => {
    it("Can stake an NFT", async () => {  
      await staking721.connect(staker).stake(tokenIdA);

      // Log for claim and unstake test
      stakedOrClaimedAtA = await staking721.stakedOrClaimedAt(tokenIdA);

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(staker.address)).to.eq(2); // still has tokenIdB and tokenIdC
      expect(await staking721.balanceOf(staker.address)).to.eq(1);
    });

    it("Can stake multiple NFTs", async () => {
      const balanceBefore = await mockERC721.balanceOf(staker.address);
      const balanceBeforeSNFT = await staking721.balanceOf(staker.address);

      // Stake multiple 
      await staking721.connect(staker).stakeBulk([tokenIdB, tokenIdC]);

      stakedOrClaimedAtB = await staking721.stakedOrClaimedAt(tokenIdB);
      stakedOrClaimedAtC = await staking721.stakedOrClaimedAt(tokenIdC);

      const balanceAfter = await mockERC721.balanceOf(staker.address);
      const balanceAfterSNFT = await staking721.balanceOf(staker.address);

      expect(balanceAfter).to.eq(balanceBefore - 2n);
      expect(balanceAfterSNFT).to.eq(balanceBeforeSNFT + 2n);

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(staker.address)).to.eq(0); // still has tokenIdB and tokenIdC
      expect(await staking721.balanceOf(staker.address)).to.eq(3);

      // Reset state // comebackhere
      await staking721.connect(staker).removeStakeBulk([tokenIdB, tokenIdC]);
      // await mockERC721.connect(deployer).burn(tokenIdB);
      // await mockERC721.connect(deployer).burn(tokenIdC);
    });
  
    it("Fails to stake when the token id is invalid", async () => {
      // No new token is created, so id is invalid
      await expect(staking721.connect(staker).stake(nonMintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  
    it("Fails to stake when the token is already staked", async () => {
      // If the token is staked, the owner will be the staking contract not the original owner
      await expect(
        staking721.connect(staker).stake(tokenIdA)
      ).to.be.revertedWithCustomError(staking721, "InvalidOwner");  
    });
  
    it("Fails to stake when the caller is not the owner of the NFT", async () => {
      // Staker does not own the newly minted token and cannot stake it
      // await mockERC721.connect(deployer).mint(deployer.address, 123912398);

      await expect(staking721.connect(staker).stake(nonStakedTokenId)).to.be.revertedWithCustomError(staking721, "InvalidOwner");

      // Reset
      // await mockERC721.connect(staker).transferFrom(deployer.address, staker.address, tokenIdB);
      
    });
  })

  describe("#claim | #claimBulk", () => {
    it("Can claim rewards on a staked token", async () => {
      // Move forward in time one period to be able to claim
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await mockERC20.balanceOf(staker.address);
      
      // Store for calculation below
      const accessTimestamp = stakedOrClaimedAtA;
      
      // const pendingRewards = await staking721.viewPendingRewards(tokenIdA);
      await staking721.connect(staker).claim(tokenIdA);
      
      stakedOrClaimedAtA = await staking721.stakedOrClaimedAt(tokenIdA);

      const expectedRewards = calcRewardsAmount(
        config,
        BigInt(1),
        stakedOrClaimedAtA - accessTimestamp 
      );

      const balanceAfter = await mockERC20.balanceOf(staker.address);
      
      // One period has passed, expect that rewards for one period were given
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
    });

    it("Can claim rewards on multiple staked tokens", async () => {
      // Move forward in time one period to be able to claim
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      const accessTimestampB = stakedOrClaimedAtB;
      const accessTimestampC = stakedOrClaimedAtC;

      await staking721.connect(staker).claimBulk([tokenIdB, tokenIdC]);

      stakedOrClaimedAtB = await staking721.stakedOrClaimedAt(tokenIdB);
      stakedOrClaimedAtC = await staking721.stakedOrClaimedAt(tokenIdC);

      const expectedRewardsB = calcRewardsAmount(
        config,
        BigInt(1),
        stakedOrClaimedAtB - accessTimestampB
      );

      const expectedRewardsC = calcRewardsAmount(
        config,
        BigInt(1),
        stakedOrClaimedAtC - accessTimestampC
      );

      const balanceAfter = await mockERC20.balanceOf(staker.address);
      
      // One period has passed, expect that rewards for one period were given
      expect(balanceAfter).to.eq(balanceBefore + expectedRewardsB + expectedRewardsC);
    });

    it ("Fails to claim when not enough time has passed", async () => {
      await expect(staking721.connect(staker).claim(tokenIdB)).to.be.revertedWithCustomError(staking721, "InvalidClaim")
    });

    it ("Fails to claim when the token ID is invalid", async () => {
      // No new token is created, so id is invalid
      await expect(staking721.connect(staker).claim(nonMintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to claim when the caller is not the owner of the SNFT", async () => {
      await expect(staking721.connect(notStaker).claim(tokenIdA)).to.be.revertedWithCustomError(staking721, "InvalidOwner")
    });
    
    it("Fails to claim when the token ID is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist
      await expect(staking721.connect(staker).claim(nonStakedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  });

  describe("#unstake", () => {
    it("Can unstake a token", async () => {
      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await staking721.connect(staker).unstake(tokenIdA);

      // `stakedOrClaimedAt` is updated in the contract to 0, get the timestamp this way
      const timestamp = (await hre.ethers.provider.getBlock("latest"))?.timestamp;
      
      const balanceAfter = await mockERC20.balanceOf(staker.address);

      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcRewardsAmount(
        config,
        BigInt(1),
        BigInt(timestamp!) - stakedOrClaimedAtA
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
      
      // User has regained their NFT and the SNFT was burned
      expect(await mockERC721.balanceOf(staker.address)).to.eq(1);
      expect(await staking721.balanceOf(staker.address)).to.eq(2); // still have tokenIdB and tokenIdC
      await expect(staking721.ownerOf(tokenIdA)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Can unstake multiple tokens", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      // await mockERC721.connect(staker).ownerOf(tokenIdA);
      // await mockERC721.connect(staker).ownerOf(tokenIdC);
      // await staking721.connect(staker).ownerOf(tokenIdB);
      // await mockERC721.connect(staker).ownerOf(tokenIdB);

      // await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdB);
      // await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdC);

      const varA = await mockERC721.balanceOf(staker.address);
      const varb = await staking721.balanceOf(staker.address);
      const varzz = await mockERC721.ownerOf(tokenIdA); // only mock has A

      const varsd = await mockERC721.ownerOf(tokenIdC);
      const vard = await staking721.ownerOf(tokenIdC); // both contracts have tokenIdC here
      
      const vare = await staking721.ownerOf(tokenIdB); // only staking has B

      // await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdB);

      await staking721.connect(staker).unstakeBulk([tokenIdB]); // why invalid token id?

      // `stakedOrClaimedAt` is updated in the contract to 0, get the timestamp this way
      const timestamp = (await hre.ethers.provider.getBlock("latest"))?.timestamp;
      
      const balanceAfter = await mockERC20.balanceOf(staker.address);

      // One period has passed, expect that rewards for one period were given
      const expectedRewardsB = calcRewardsAmount(
        config,
        BigInt(1),
        BigInt(timestamp!) - stakedOrClaimedAtB
      );

      const expectedRewardsC = calcRewardsAmount(
        config,
        BigInt(1),
        BigInt(timestamp!) - stakedOrClaimedAtC
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewardsB + expectedRewardsC);
      
      // User has regained their NFTs and the SNFT was burned
      expect(await mockERC721.balanceOf(staker.address)).to.eq(3);
      expect(await staking721.balanceOf(staker.address)).to.eq(0);
      await expect(staking721.ownerOf(tokenIdB)).to.be.revertedWith(INVALID_TOKEN_ID);
      await expect(staking721.ownerOf(tokenIdC)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to unstake when not enough time has passed", async () => {
      // Restake to be able to unstake again
      await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdA);
      await staking721.connect(staker).stake(tokenIdA);

      await expect(staking721.connect(staker).unstake(tokenIdA)).to.be.revertedWithCustomError(staking721, "InvalidUnstake");
    });

    it("Fails when token id is invalid", async () => {
      await expect(staking721.connect(staker).unstake(nonMintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails when caller is not the owner of the SNFT", async () => {
      await expect(staking721.connect(notStaker).unstake(tokenIdA)).to.be.revertedWithCustomError(staking721, "InvalidOwner");
    });

    it("Fails when token id is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist and so we can't unstake it
      await expect(staking721.connect(staker).unstake(nonStakedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);

      // To reset state, we unstake here
      await time.increase(config.periodLength);
      await staking721.connect(staker).unstake(tokenIdA);
    });
  });

  describe("#removeStake | #removeStakeBulk", () => {
    it("Allows the user to remove their stake within the timelock period without rewards", async () => {
      await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdA);
      // await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdB);
      // await mockERC721.connect(staker).approve(await staking721.getAddress(), tokenIdC);

      await staking721.connect(staker).stakeBulk([tokenIdB, tokenIdC]);

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(staker.address)).to.eq(0);
      expect(await staking721.balanceOf(staker.address)).to.eq(3);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await staking721.connect(staker).removeStake(tokenIdA);

      const balanceAfter = await mockERC20.balanceOf(staker.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(staker.address)).to.eq(1);
      expect(await staking721.balanceOf(staker.address)).to.eq(2);
    });

    // TODO cases
    // fails when not owner of sNFT
    // fails when token id is invalid
    // fails when token id is not staked (snft does not exist)
    // fails on claim when not enough time has passed, single and bulk

    it("Allows the user to remove multiple stakes within the timelock period without rewards", async () => {

      // Stake multiple
      // await staking721.connect(staker).stakeBulk([tokenIdA, tokenIdB, tokenIdC]);

      expect(await mockERC721.balanceOf(staker.address)).to.eq(1);
      expect(await staking721.balanceOf(staker.address)).to.eq(2);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      // Verify we can remove multiple stakes in a single tx
      await staking721.connect(staker).removeStakeBulk([tokenIdB, tokenIdC]);

      const balanceAfter = await mockERC20.balanceOf(staker.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(staker.address)).to.eq(3);
      expect(await staking721.balanceOf(staker.address)).to.eq(0);
    });
  });
});