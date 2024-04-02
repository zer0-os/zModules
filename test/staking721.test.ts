import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  GasTests,
  MockERC20,
  MockERC721,
  StakingERC721,
} from "../typechain";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  PoolConfig, StakedOrClaimedAt,
} from "./helpers/staking/types";
import { INVALID_TOKEN_ID, ONLY_NFT_OWNER } from "./helpers/staking/errors";
import { createDefaultConfigs } from "./helpers/staking/defaults";
import { calcRewardsAmount } from "./helpers/staking/rewards";
import { staking } from "../typechain/contracts";

describe("StakingERC721", () => {
  let deployer : SignerWithAddress;
  let staker : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let stakingERC721 : StakingERC721;

  let mockERC20 : MockERC20;
  let mockERC721 : MockERC721;

  let config : PoolConfig;
  
  // Default token ids
  const tokenIdA = 1;
  const tokenIdB = 2;
  const tokenIdC = 3;
  const tokenIdDelayed = 4;
  const nonStakedTokenId = 5; // Never used in `stake`
  const nonMintedTokenId = 6; // Never minted

  // let stakeData : StakedOrClaimedAt;


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

    const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
    stakingERC721 = await stakingFactory.deploy(
      "StakingNFT",
      "SNFT",
      config
    ) as StakingERC721;

    // Give staking contract balance to pay rewards
    await mockERC20.connect(deployer).transfer(
      await stakingERC721.getAddress(),
      hre.ethers.parseEther("9000000000000")
    );

    await mockERC721.connect(deployer).mint(staker.address, tokenIdA);
    await mockERC721.connect(deployer).mint(staker.address, tokenIdB);
    await mockERC721.connect(deployer).mint(staker.address, tokenIdC);
    await mockERC721.connect(deployer).mint(deployer.address, nonStakedTokenId);

    await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdA);
    await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdB);
    await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdC);
  });

  describe("#viewRewardsInPool", () => {
    it("Allows a user to see the total rewards in a pool", async () => {
      const rewardsInPool = await stakingERC721.getContractRewardsBalance()
      expect(rewardsInPool).to.eq(await mockERC20.balanceOf(await stakingERC721.getAddress()));
    });
  });

  describe("#stake | #stakeBulk", () => {
    it("Can stake an NFT", async () => {
      await stakingERC721.connect(staker).stake(tokenIdA);

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(staker.address)).to.eq(2); // still has tokenIdB and tokenIdC
      expect(await stakingERC721.balanceOf(staker.address)).to.eq(1);
    });

    it("Can stake multiple NFTs", async () => {
      // Stake multiple 
      await stakingERC721.connect(staker).stakeBulk([tokenIdB, tokenIdC]);

      // User has staked their remaining NFTs and gained two SNFTs
      expect(await mockERC721.balanceOf(staker.address)).to.eq(0);
      expect(await stakingERC721.balanceOf(staker.address)).to.eq(3);
    });
  
    it("Fails to stake when the token id is invalid", async () => {
      // No new token is created, so id is invalid
      await expect(stakingERC721.connect(staker).stake(nonMintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  
    it("Fails to stake when the token is already staked", async () => {
      // If the token is staked, the owner will be the staking contract not the original owner
      await expect(
        stakingERC721.connect(staker).stake(tokenIdA)
      ).to.be.revertedWithCustomError(stakingERC721, "InvalidOwner");  
    });
  
    it("Fails to stake when the caller is not the owner of the NFT", async () => {
      // Staker does not own the token and cannot stake it
      await expect(stakingERC721.connect(staker).stake(nonStakedTokenId))
        .to.be.revertedWithCustomError(stakingERC721, "InvalidOwner");
    });
  });

  describe("#getRemainingLockTime", () => {
    it("Allows the user to view the remaining time lock period for a stake", async () => {
      const remainingTimeLock = await stakingERC721.connect(staker).getRemainingLockTime();
      const latest = await time.latest();

      const stakeData = await stakingERC721.stakes(staker.address);

      // Original lock period and remaining lock period time difference should be the same as 
      // the difference between the latest timestamp and that token's stake timestamp 
      expect(remainingTimeLock).to.eq((stakeData.unlockTimestamp - BigInt(latest)));
    });
  });

  describe("#getPendingRewards | #getPendingRewardsBulk", () => {
    it("Can view pending rewards for a staked token", async () => {
      // Move timestamp forward to accrue rewards
      await time.increase(config.timeLockPeriod / 2n);

      const pendingRewards = await stakingERC721.getPendingRewards(tokenIdA);
      const timestamp = await time.latest()

      const expectedRewards = calcRewardsAmount(
        BigInt(timestamp) - stakeData.stakeTimestamp,
        BigInt(1),
        config,
      );

      // Accurate calculation before the lock period
      expect(pendingRewards).to.eq(expectedRewards);
    });

    it("Can view pending rewards for multiple staked tokens", async () => {
      const pendingRewards = await stakingERC721.getPendingRewardsBulk([tokenIdB, tokenIdC]);

      const timestamp = await time.latest()

      const expectedRewardsB = calcRewardsAmount(
        BigInt(timestamp!) - stakedOrClaimedAtB.stakeTimestamp,
        BigInt(1),
        config,
      );

      const expectedRewardsC = calcRewardsAmount(
        BigInt(timestamp!) - stakedOrClaimedAtC.stakeTimestamp,
        BigInt(1),
        config,
      );

      expect(pendingRewards).to.eq(expectedRewardsB + expectedRewardsC);
    });
  });

  describe("#claim | #claimBulk", () => {
    it("Can claim rewards on a staked token", async () => {
      await time.increase(config.timeLockPeriod / 2n);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      const pendingRewards = await stakingERC721.getPendingRewards(tokenIdA);
      await stakingERC721.connect(staker).claim(tokenIdA);
      const balanceAfter = await mockERC20.balanceOf(staker.address);
      
      stakeData = await stakingERC721.stakedOrClaimedAt(tokenIdA);
      const timestamp = await time.latest()

      const expectedRewards = calcRewardsAmount(
        BigInt(timestamp) - stakeData.stakeTimestamp,
        BigInt(1),
        config,
      );

      // One period has passed, expect that rewards for one period were given
      // We do + 1n on pendingRewards because it automatically adds 1 to the timestamp when we call a tx
      expect(pendingRewards + 1n).to.eq(expectedRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
      expect(balanceAfter).to.eq(balanceBefore + pendingRewards + 1n);

      // Cannot double claim, rewards are reset by timestamp change onchain
      const pendingRewardsAfterClaim = await stakingERC721.getPendingRewards(tokenIdA);

      await stakingERC721.connect(staker).claim(tokenIdA);
      stakeData = await stakingERC721.stakedOrClaimedAt(tokenIdA);

      const balanceAfterClaim = await mockERC20.balanceOf(staker.address);
      expect(pendingRewardsAfterClaim + 1n).to.eq(balanceAfterClaim - balanceAfter);
    });

    it("Can claim rewards on multiple staked tokens", async () => {
      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await stakingERC721.ownerOf(tokenIdB);
      await stakingERC721.ownerOf(tokenIdC);

      await stakingERC721.connect(staker).claimBulk([tokenIdB, tokenIdC]);

      stakedOrClaimedAtB = await stakingERC721.stakedOrClaimedAt(tokenIdB);
      stakedOrClaimedAtC = await stakingERC721.stakedOrClaimedAt(tokenIdC);

      const expectedRewardsB = calcRewardsAmount(
        stakedOrClaimedAtB.claimTimestamp - stakedOrClaimedAtB.stakeTimestamp,
        BigInt(1),
        config,
      );

      const expectedRewardsC = calcRewardsAmount(
        stakedOrClaimedAtC.claimTimestamp - stakedOrClaimedAtC.stakeTimestamp,
        BigInt(1),
        config,
      );

      const balanceAfter = await mockERC20.balanceOf(staker.address);
      
      // One period has passed, expect that rewards for one period were given
      expect(balanceAfter).to.eq(balanceBefore + expectedRewardsB + expectedRewardsC);
    });

    it ("Fails to claim when not enough time has passed", async () => {
      await mockERC721.connect(deployer).mint(staker.address, tokenIdDelayed);
      await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdDelayed);

      await stakingERC721.connect(staker).stake(tokenIdDelayed);
      stakedOrClaimedAtD = await stakingERC721.stakedOrClaimedAt(tokenIdDelayed);

      
      // Do not fast forward time here, so the user cannot claim
      await expect(stakingERC721.connect(staker).claim(tokenIdDelayed)).to.be.revertedWithCustomError(stakingERC721, "TimeLockNotPassed")
    });

    it ("Fails to claim when the token ID is invalid", async () => {
      // No new token is created, so id is invalid
      await expect(stakingERC721.connect(staker).claim(nonMintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to claim when the caller is not the owner of the SNFT", async () => {
      await expect(stakingERC721.connect(notStaker).claim(tokenIdA)).to.be.revertedWithCustomError(stakingERC721, "InvalidOwner")
    });
    
    it("Fails to claim when the token ID is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist
      await expect(stakingERC721.connect(staker).claim(nonStakedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  });

  describe("#unstake | #unstakeBulk", () => {
    it("Can unstake a token", async () => {
      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await stakingERC721.connect(staker).unstake(tokenIdA);

      // `stakedOrClaimedAt` is updated in the contract to 0, get the timestamp this way
      const timestamp = await time.latest();
      
      const balanceAfter = await mockERC20.balanceOf(staker.address);

      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcRewardsAmount(
        BigInt(timestamp!) - stakeData.claimTimestamp,
        BigInt(1),
        config,
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
      
      // User has regained their NFT and the SNFT was burned
      expect(await mockERC721.balanceOf(staker.address)).to.eq(1);
      expect(await stakingERC721.balanceOf(staker.address)).to.eq(3);
      await expect(stakingERC721.ownerOf(tokenIdA)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Can unstake multiple tokens", async () => {
      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await stakingERC721.connect(staker).unstakeBulk([tokenIdB, tokenIdC]);

      // `stakedOrClaimedAt` is updated in the contract to 0, get the timestamp this way
      const timestamp = await time.latest();
      
      const balanceAfter = await mockERC20.balanceOf(staker.address);

      // One period has passed, expect that rewards for one period were given
      const expectedRewardsB = calcRewardsAmount(
        BigInt(timestamp!) - stakedOrClaimedAtB.claimTimestamp,
        BigInt(1),
        config,
      );

      const expectedRewardsC = calcRewardsAmount(
        BigInt(timestamp!) - stakedOrClaimedAtC.claimTimestamp,
        BigInt(1),
        config,
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewardsB + expectedRewardsC);
      
      // User has regained their NFTs and the SNFT was burned
      expect(await mockERC721.balanceOf(staker.address)).to.eq(3);
      expect(await stakingERC721.balanceOf(staker.address)).to.eq(1); // still has tokenIdDelayed staked
      await expect(stakingERC721.ownerOf(tokenIdB)).to.be.revertedWith(INVALID_TOKEN_ID);
      await expect(stakingERC721.ownerOf(tokenIdC)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to unstake when not enough time has passed", async () => {
      // Restake to be able to unstake again
      await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingERC721.connect(staker).stake(tokenIdA);

      await expect(stakingERC721.connect(staker).unstake(tokenIdA)).to.be.revertedWithCustomError(stakingERC721, "TimeLockNotPassed");
    });

    it("Fails to unstake when token id is invalid", async () => {
      await expect(stakingERC721.connect(staker).unstake(nonMintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to unstake when caller is not the owner of the SNFT", async () => {
      await expect(stakingERC721.connect(notStaker).unstake(tokenIdA)).to.be.revertedWithCustomError(stakingERC721, "InvalidOwner");
    });

    it("Fails to unstake when token id is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist and so we can't unstake it
      await expect(stakingERC721.connect(staker).unstake(nonStakedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  });

  describe("#removeStake | #removeStakeBulk", () => {
    // fails if user doesnt own the SNFT
    // fails if snft is invalid
    it("Fails if the caller does not own the sNFT", async () => {
      await expect(stakingERC721.connect(notStaker).exitWithoutRewards(tokenIdA))
      .to.be.revertedWithCustomError(stakingERC721, "InvalidOwner");
    });

    it("Fails if the sNFT is invalid", async () => {
      // Because we `burn` on exit, the token would be invalid and it is the same test
      // as if the owner has already exited
      await expect(stakingERC721.connect(notStaker).exitWithoutRewards(nonMintedTokenId))
      .to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Allows the user to remove their stake within the timelock period without rewards", async () => {
      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(staker.address)).to.eq(2); // tokenIdB and TokenIdC
      expect(await stakingERC721.balanceOf(staker.address)).to.eq(2); // tokenIdA and tokenIdDelayed

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await stakingERC721.connect(staker).exitWithoutRewards(tokenIdA);

      const balanceAfter = await mockERC20.balanceOf(staker.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(staker.address)).to.eq(3);
      expect(await stakingERC721.balanceOf(staker.address)).to.eq(1);
    });

    it("Allows the user to remove multiple stakes within the timelock period without rewards", async () => {
      // Stake multiple
      await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdB);
      await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdC);
      await stakingERC721.connect(staker).stakeBulk([tokenIdB, tokenIdC]);

      expect(await mockERC721.balanceOf(staker.address)).to.eq(1);
      expect(await stakingERC721.balanceOf(staker.address)).to.eq(3);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      // Verify we can remove multiple stakes in a single tx
      await stakingERC721.connect(staker).exitWithoutRewardsBulk([tokenIdB, tokenIdC, tokenIdDelayed]);

      const balanceAfter = await mockERC20.balanceOf(staker.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(staker.address)).to.eq(4);
      expect(await stakingERC721.balanceOf(staker.address)).to.eq(0);
    });
  });

  describe("Events", () => {
    it("Staking emits a 'Staked' event", async () => {
      // Transfer back to staker so they can trigger the `Staked` event
      await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdA);

      await expect(stakingERC721.connect(staker).stake(tokenIdA))
        .to.emit(stakingERC721, "Staked")
        .withArgs(tokenIdA, 1n, 0n, config.stakingToken);
    });

    it("Staking multiple tokens emits multiple 'Staked' events", async () => {
      // Transfer back to staker so they can trigger the `Staked` event
      await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdB);
      await mockERC721.connect(staker).approve(await stakingERC721.getAddress(), tokenIdC);

      expect(await stakingERC721.connect(staker).stakeBulk([tokenIdB, tokenIdC]))
        .to.emit(stakingERC721, "Staked")
        .withArgs(tokenIdB, 1n, 0n, config.stakingToken)
        .to.emit(stakingERC721, "Staked")
        .withArgs(tokenIdC, 1n, 0n, config.stakingToken);
    });

    it("Claim emits a 'Claimed' event", async () => {
      await time.increase(config.timeLockPeriod);

      const pendingRewards = await stakingERC721.getPendingRewards(tokenIdA);
      expect(await stakingERC721.connect(staker).claim(tokenIdA))
        .to.emit(stakingERC721, "Claimed")
        .withArgs(tokenIdA, pendingRewards + 1n, config.rewardsToken);
    });

    it("Claiming multiple tokens emits multiple 'Claimed' events", async () => {
      await time.increase(config.timeLockPeriod);

      const pendingRewardsB = await stakingERC721.getPendingRewards(tokenIdB);
      const pendingRewardsC = await stakingERC721.getPendingRewards(tokenIdB);
      const balanceBefore = await mockERC20.balanceOf(staker.address);

      expect(await stakingERC721.connect(staker).claimBulk([tokenIdB, tokenIdC]))
        .to.emit(stakingERC721, "Claimed")
        .withArgs(tokenIdB, pendingRewardsB + 1n, config.rewardsToken)
        .to.emit(stakingERC721, "Claimed")
        .withArgs(tokenIdC, pendingRewardsC + 1n, config.rewardsToken);
      
      const balanceAfter = await mockERC20.balanceOf(staker.address);
      expect(balanceAfter).to.eq(balanceBefore + pendingRewardsB + pendingRewardsC + 2n);
    });

    it("Unstake Emits an 'Unstaked' event", async () => {
      await time.increase(config.timeLockPeriod);

      const pendingRewards = await stakingERC721.getPendingRewards(tokenIdA);
      await expect(stakingERC721.connect(staker).unstake(tokenIdA))
        .to.emit(stakingERC721, "Unstaked")
        .withArgs(tokenIdA, 1n, 0n, pendingRewards + 1n, config.stakingToken);
    });

    it("Unstaking multiple tokens emits multiple 'Unstaked' events", async () => {
      await time.increase(config.timeLockPeriod);

      const pendingRewardsB = await stakingERC721.getPendingRewards(tokenIdB);
      const pendingRewardsC = await stakingERC721.getPendingRewards(tokenIdB);
      const balanceBefore = await mockERC20.balanceOf(staker.address);

      expect(await stakingERC721.connect(staker).unstakeBulk([tokenIdB, tokenIdC]))
        .to.emit(stakingERC721, "Claimed")
        .withArgs(tokenIdB, pendingRewardsB + 1n, config.rewardsToken)
        .to.emit(stakingERC721, "Claimed")
        .withArgs(tokenIdC, pendingRewardsC + 1n, config.rewardsToken);
      
      const balanceAfter = await mockERC20.balanceOf(staker.address);
      expect(balanceAfter).to.eq(balanceBefore + pendingRewardsB + pendingRewardsC + 2n);
    });
  });
  describe("Other configs", () => {
    it("Disallows empty transfer", async () => {
      const config = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        poolWeight: BigInt(1),
        periodLength: BigInt(5000000000000),
        timeLockPeriod: BigInt(1)
      } as PoolConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        config
      ) as StakingERC721;

      await mockERC721.connect(staker).approve(await localStakingERC721.getAddress(), tokenIdA);

      await localStakingERC721.connect(staker).stake(tokenIdA);

      await time.increase(config.timeLockPeriod + 1n);

      await expect(stakingERC721.connect(staker).claim(tokenIdA)).to.be.revertedWithCustomError(stakingERC721, "NoRewards")
    })
  });
});