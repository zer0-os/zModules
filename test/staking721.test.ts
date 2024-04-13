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
import { INCORRECT_OWNER_TRANSFER, INVALID_OWNER, INVALID_TOKEN_ID, ONLY_NFT_OWNER, TIME_LOCK_NOT_PASSED } from "./helpers/staking/errors";
import { createDefaultConfigs } from "./helpers/staking/defaults";
import { calcRewardsAmount, calcTotalRewards } from "./helpers/staking/rewards";
import { staking } from "../typechain/contracts";

describe("StakingERC721", () => {
  let deployer : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let stakingERC721 : StakingERC721;

  let mockERC20 : MockERC20;
  let mockERC721 : MockERC721;

  let config : PoolConfig;

  let stakedAtA : bigint;
  let stakedAtB : bigint;
  let stakedAtC : bigint;
  let stakedAtD : bigint;

  let claimedAt : bigint;
  let unstakedAt : bigint;

  let balanceAtStakeOne : bigint;
  let balanceAtStakeTwo : bigint;

  let durationOne : bigint;
  let durationTwo : bigint;

  // Value to add expected rewards as we move through the flow
  let rewards : bigint = 0n
  
  // Default token ids
  const tokenIdA = 1;
  const tokenIdB = 2;
  const tokenIdC = 3;
  const tokenIdDelayed = 7;
  const nonStakedTokenId = 8; // Never used in `stake`
  const unmintedTokenId = 9; // Never minted

  before(async () => {
    [
      deployer,
      stakerA,
      stakerB,
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

    await mockERC721.connect(deployer).mint(stakerA.address, tokenIdA);
    await mockERC721.connect(deployer).mint(stakerA.address, tokenIdB);
    await mockERC721.connect(deployer).mint(stakerA.address, tokenIdC);
    await mockERC721.connect(deployer).mint(deployer.address, nonStakedTokenId);

    await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
    await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
    await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);
  });

  describe("#viewRewardsInPool", () => {
    it("Allows a user to see the total rewards in a pool", async () => {
      const rewardsInPool = await stakingERC721.getContractRewardsBalance()
      expect(rewardsInPool).to.eq(await mockERC20.balanceOf(await stakingERC721.getAddress()));
    });
  });

  describe("#stake | #stakeBulk", () => {
    it("Can stake an NFT", async () => {
      await stakingERC721.connect(stakerA).stake(tokenIdA);
      stakedAtA = await (await stakingERC721.stakes(stakerA.address)).lastUpdatedTimestamp;
      balanceAtStakeOne = await stakingERC721.balanceOf(stakerA.address);

      const tokenIds = await stakingERC721.connect(stakerA).showAll();


      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(2); // still has tokenIdB and tokenIdC
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(1);
    });

    it("Can stake multiple NFTs", async () => {
      // Stake multiple 
      // const pendingRewardsBefore = await stakingERC721.connect(staker).getPendingRewards();
      rewards += await stakingERC721.connect(stakerA).getPendingRewards();

      await stakingERC721.connect(stakerA).stakeBulk([tokenIdB, tokenIdC]);
      stakedAtB = await (await stakingERC721.stakes(stakerA.address)).lastUpdatedTimestamp
      stakedAtC = stakedAtB;

      const tokenIds = await stakingERC721.connect(stakerA).showAll();

      balanceAtStakeTwo = await stakingERC721.balanceOf(stakerA.address);

      rewards += await stakingERC721.connect(stakerA).getPendingRewards(); // not sure about this

      // User has staked their remaining NFTs and gained two SNFTs
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(3);
    });
  
    it("Fails to stake when the token id is invalid", async () => {
      // No new token is created, so id is invalid
      await expect(stakingERC721.connect(stakerA).stake(unmintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  
    it("Fails to stake when the token is already staked", async () => {
      // If the token is staked, the owner will be the staking contract not the original owner
      await expect(
        stakingERC721.connect(stakerA).stake(tokenIdA)
      ).to.be.revertedWith(INCORRECT_OWNER_TRANSFER);  
    });
  
    it("Fails to stake when the caller is not the owner of the NFT", async () => {
      // Staker does not own the token and cannot stake it
      await expect(stakingERC721.connect(stakerA).stake(nonStakedTokenId))
        .to.be.revertedWith(ONLY_NFT_OWNER);
    });
  });

  describe("#getRemainingLockTime", () => {
    it("Allows the user to view the remaining time lock period for a stake", async () => {
      const remainingLockTime = await stakingERC721.connect(stakerA).getRemainingLockTime();
      const latest = await time.latest();

      const stakeData = await stakingERC721.stakes(stakerA.address);

      // Original lock period and remaining lock period time difference should be the same as 
      // the difference between the latest timestamp and that token's stake timestamp 
      expect(remainingLockTime).to.eq((stakeData.unlockTimestamp - BigInt(latest)));
    });
  });

  describe("#getPendingRewards | #getPendingRewardsBulk", () => {
    it("Can view pending rewards for a user", async () => {
      durationOne = stakedAtB - stakedAtA;
      durationTwo = BigInt(await time.latest()) - stakedAtB;

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      const totalRewards = calcTotalRewards(
        [durationOne, durationTwo],
        [balanceAtStakeOne, balanceAtStakeTwo],
        config
      );

      // Accurate calculation before the lock period
      expect(pendingRewards).to.eq(totalRewards);
    });
  });

  describe("#claim | #claimBulk", () => {
    it("Can claim rewards when staked and past the timeLockPeriod", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      await stakingERC721.connect(stakerA).claim();

      const tokenIds = await stakingERC721.connect(stakerA).showAll();

      // Update timestamps
      // maybe only need one going forward though?
      claimedAt = BigInt(await time.latest());

      const expectedRewards = calcTotalRewards(
        [durationOne, claimedAt - stakedAtB],
        [balanceAtStakeOne, balanceAtStakeTwo],
        config
      )

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);

      // Cannot double claim, rewards are reset by timestamp change onchain      
      // Call to tx moves timestamp ahead before executing tx, so staker gets +1s worth of rewards only
      await stakingERC721.connect(stakerA).claim();

      const expectedRewardsReclaim = calcTotalRewards(
        [1n],
        [balanceAtStakeTwo],
        config
      )

      const balanceAfterClaim = await mockERC20.balanceOf(stakerA.address);

      expect(balanceAfterClaim).to.eq(balanceAfter + expectedRewardsReclaim);
    });

    it ("Fails to claim when not enough time has passed", async () => {
      await mockERC721.connect(deployer).mint(stakerB.address, tokenIdDelayed);
      await mockERC721.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdDelayed);

      await stakingERC721.connect(stakerB).stake(tokenIdDelayed);
      stakedAtD = BigInt(await time.latest());

      // Do not fast forward time here, so the user cannot claim
      await expect(stakingERC721.connect(stakerB).claim()).to.be.revertedWithCustomError(stakingERC721, TIME_LOCK_NOT_PASSED)
    });

    it("Fails to claim when the caller has no stakes", async () => {
      // Will fail when we check `onlyUnlocked` modifier first
      await expect(stakingERC721.connect(notStaker).claim()).to.be.revertedWithCustomError(stakingERC721, TIME_LOCK_NOT_PASSED);
    });

  });

  describe("#unstake | #unstakeBulk", () => {
    it("Can unstake a token", async () => {
      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      // Regular unstake, not calling to "exit"
      await stakingERC721.connect(stakerA).unstake(tokenIdA, false);

      unstakedAt = BigInt(await time.latest());
      
      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcRewardsAmount(
        unstakedAt - claimedAt - 1n,
        balanceAtStakeTwo,
        config,
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
      
      // User has regained their NFT and the SNFT was burned
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(2);
      await expect(stakingERC721.ownerOf(tokenIdA)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Can unstake all staked tokens at once", async () => {
      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      const tokenIds = await stakingERC721.connect(stakerA).showAll();
      await stakingERC721.connect(stakerA).unstakeAll(false);

      // `stakedOrClaimedAt` is updated in the contract to 0, get the timestamp this way
      const timestamp = BigInt(await time.latest());
      
      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcTotalRewards(
        [timestamp - unstakedAt],
        [balanceAtStakeTwo - 1n],
        config,
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
      
      // User has regained their NFTs and the SNFT was burned
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(3);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(0);
      await expect(stakingERC721.ownerOf(tokenIdB)).to.be.revertedWith(INVALID_TOKEN_ID);
      await expect(stakingERC721.ownerOf(tokenIdC)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to unstake when not enough time has passed", async () => {
      // Restake to be able to unstake again
      await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingERC721.connect(stakerA).stake(tokenIdA);

      // Try to unstake before the time lock period has passed
      await expect(stakingERC721.connect(stakerA).unstake(tokenIdA, false)).to.be.revertedWithCustomError(stakingERC721, TIME_LOCK_NOT_PASSED);
    });

    it("Fails to unstake when token id is invalid", async () => {
      // Time lock check reverts when the `unlockTimestamp` for a user is 0 indicating they haven't staked
      await expect(stakingERC721.connect(stakerA).unstake(unmintedTokenId, false)).to.be.revertedWithCustomError(stakingERC721, TIME_LOCK_NOT_PASSED);

      await time.increase(config.timeLockPeriod);

      // Now this will fail because the token id is invalid
      await expect(stakingERC721.connect(stakerA).unstake(unmintedTokenId, false)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to unstake when caller is not the owner of the SNFT", async () => {
      // transfer token from stakerA to stakerB
      await mockERC721.connect(stakerA).transferFrom(stakerA.address, stakerB.address, tokenIdB);

      await mockERC721.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingERC721.connect(stakerB).stake(tokenIdB);

      await expect(stakingERC721.connect(stakerB).unstake(tokenIdA, false)).to.be.revertedWithCustomError(stakingERC721, INVALID_OWNER);
    });

    it("Fails to unstake when token id exists but is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist and so we can't unstake it
      await expect(stakingERC721.connect(stakerA).unstake(nonStakedTokenId, false)).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  });

  describe("#removeStake | #removeStakeBulk", () => {
    it("Fails if the caller does not own the sNFT", async () => {
      await expect(stakingERC721.connect(notStaker).unstake(tokenIdA, true))
      .to.be.revertedWithCustomError(stakingERC721, INVALID_OWNER);
    });

    it("Fails if the sNFT is invalid", async () => {
      // Because we `burn` on exit, the token would be invalid and it is the same test
      // as if the owner has already exited
      await expect(stakingERC721.connect(notStaker).unstake(unmintedTokenId, true))
      .to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Allows the user to remove their stake within the timelock period without rewards", async () => {
      const tokenIds = await stakingERC721.connect(stakerA).showAll();

      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(1);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      await stakingERC721.connect(stakerA).unstake(tokenIdA, true);

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(2);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(0);
    });

    it("Allows the user to remove multiple stakes within the timelock period without rewards", async () => {
      // Stake multiple
      // await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      // await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);
      // await stakingERC721.connect(stakerA).stakeBulk([tokenIdB, tokenIdC]);

      // expect(await mockERC721.balanceOf(stakerA.address)).to.eq(1);
      // expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(3);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      // Verify we can remove multiple stakes in a single tx
      // await stakingERC721.connect(stakerA).unstake();
      const tx = await stakingERC721.connect(stakerA).unstakeAll(true);

      const receipt = await tx.wait();

      // staker A staked "B" in the past
      // then after unstaking successfully, transferred "B" to staker B
      // staker B stakes "B"
      // staker A calls "unstakeAll", but "B" still exists in staker A's stake array
      // so it passes the `exists` check, but fails ownership check

      // using a mapping and a `numStaked` counter
      // if we have 5 staked
        // call to `unstakeAll` will work, if we call it first
        // call to `unstake(specificToken)` will break `unstakeAll` down the road
        // because we have created a gap in data
          // in an array we get something like [1, 2, 3, 0, 5]
          // in a mapping it would be similar
          // but if we decrement `numStaked` on each unstake, it doesn't indicate
          // WHICH token was unstaked, so in the above case `numStaked` is now 4,
          // how do we know to skip gap?
            // by 0 value?
            // call "exists" ?
            // call "owner" ?

      const a = await mockERC721.ownerOf(tokenIdA);
      const b = await mockERC721.ownerOf(tokenIdB);
      const c = await mockERC721.ownerOf(tokenIdC);
      const d = await mockERC721.ownerOf(tokenIdDelayed);
      const e = await mockERC721.ownerOf(nonStakedTokenId); // owned by deployer

      console.log(stakerA.address);
      console.log(stakerB.address);
      console.log(await stakingERC721.getAddress());

      // would it possibly repeat unstake on duplicate stakes that are done over time?

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(4);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(0);
    });
  });

  // describe("Events", () => {
  //   it("Staking emits a 'Staked' event", async () => {
  //     // Transfer back to staker so they can trigger the `Staked` event
  //     await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);

  //     await expect(stakingERC721.connect(stakerA).stake(tokenIdA))
  //       .to.emit(stakingERC721, "Staked")
  //       .withArgs(tokenIdA, 1n, 0n, config.stakingToken);
  //   });

  //   it("Staking multiple tokens emits multiple 'Staked' events", async () => {
  //     // Transfer back to staker so they can trigger the `Staked` event
  //     await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
  //     await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

  //     expect(await stakingERC721.connect(stakerA).stakeBulk([tokenIdB, tokenIdC]))
  //       .to.emit(stakingERC721, "Staked")
  //       .withArgs(tokenIdB, 1n, 0n, config.stakingToken)
  //       .to.emit(stakingERC721, "Staked")
  //       .withArgs(tokenIdC, 1n, 0n, config.stakingToken);
  //   });

  //   it("Claim emits a 'Claimed' event", async () => {
  //     await time.increase(config.timeLockPeriod);

  //     const pendingRewards = await stakingERC721.getPendingRewards(tokenIdA);
  //     expect(await stakingERC721.connect(stakerA).claim(tokenIdA))
  //       .to.emit(stakingERC721, "Claimed")
  //       .withArgs(tokenIdA, pendingRewards + 1n, config.rewardsToken);
  //   });

  //   it("Claiming multiple tokens emits multiple 'Claimed' events", async () => {
  //     await time.increase(config.timeLockPeriod);

  //     const pendingRewardsB = await stakingERC721.getPendingRewards(tokenIdB);
  //     const pendingRewardsC = await stakingERC721.getPendingRewards(tokenIdB);
  //     const balanceBefore = await mockERC20.balanceOf(stakerA.address);

  //     expect(await stakingERC721.connect(stakerA).claimBulk([tokenIdB, tokenIdC]))
  //       .to.emit(stakingERC721, "Claimed")
  //       .withArgs(tokenIdB, pendingRewardsB + 1n, config.rewardsToken)
  //       .to.emit(stakingERC721, "Claimed")
  //       .withArgs(tokenIdC, pendingRewardsC + 1n, config.rewardsToken);
      
  //     const balanceAfter = await mockERC20.balanceOf(stakerA.address);
  //     expect(balanceAfter).to.eq(balanceBefore + pendingRewardsB + pendingRewardsC + 2n);
  //   });

  //   it("Unstake Emits an 'Unstaked' event", async () => {
  //     await time.increase(config.timeLockPeriod);

  //     const pendingRewards = await stakingERC721.getPendingRewards(tokenIdA);
  //     await expect(stakingERC721.connect(stakerA).unstake(tokenIdA))
  //       .to.emit(stakingERC721, "Unstaked")
  //       .withArgs(tokenIdA, 1n, 0n, pendingRewards + 1n, config.stakingToken);
  //   });

  //   it("Unstaking multiple tokens emits multiple 'Unstaked' events", async () => {
  //     await time.increase(config.timeLockPeriod);

  //     const pendingRewardsB = await stakingERC721.getPendingRewards(tokenIdB);
  //     const pendingRewardsC = await stakingERC721.getPendingRewards(tokenIdB);
  //     const balanceBefore = await mockERC20.balanceOf(stakerA.address);

  //     expect(await stakingERC721.connect(stakerA).unstakeBulk([tokenIdB, tokenIdC]))
  //       .to.emit(stakingERC721, "Claimed")
  //       .withArgs(tokenIdB, pendingRewardsB + 1n, config.rewardsToken)
  //       .to.emit(stakingERC721, "Claimed")
  //       .withArgs(tokenIdC, pendingRewardsC + 1n, config.rewardsToken);
      
  //     const balanceAfter = await mockERC20.balanceOf(stakerA.address);
  //     expect(balanceAfter).to.eq(balanceBefore + pendingRewardsB + pendingRewardsC + 2n);
  //   });
  // });
  // describe("Other configs", () => {
  //   it("Disallows empty transfer", async () => {
  //     const config = {
  //       stakingToken: await mockERC721.getAddress(),
  //       rewardsToken: await mockERC20.getAddress(),
  //       poolWeight: BigInt(1),
  //       periodLength: BigInt(5000000000000),
  //       timeLockPeriod: BigInt(1)
  //     } as PoolConfig;

  //     const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
  //     const localStakingERC721 = await stakingFactory.deploy(
  //       "StakingNFT",
  //       "SNFT",
  //       config
  //     ) as StakingERC721;

  //     await mockERC721.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

  //     await localStakingERC721.connect(stakerA).stake(tokenIdA);

  //     await time.increase(config.timeLockPeriod + 1n);

  //     await expect(stakingERC721.connect(stakerA).claim(tokenIdA)).to.be.revertedWithCustomError(stakingERC721, "NoRewards")
  //   })
  // });
});