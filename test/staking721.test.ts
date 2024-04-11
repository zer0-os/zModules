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
import { INCORRECT_OWNER_TRANSFER, INVALID_TOKEN_ID, ONLY_NFT_OWNER, TIME_LOCK_NOT_PASSED } from "./helpers/staking/errors";
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
  const tokenIdA = 4;
  const tokenIdB = 5;
  const tokenIdC = 6;
  const tokenIdDelayed = 7;
  const nonStakedTokenId = 8; // Never used in `stake`
  const nonMintedTokenId = 9; // Never minted

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


      // await time.increase(config.timeLockPeriod / 2n);

      // const pendingRewards = await stakingERC721.connect(staker).getPendingRewards();
      // const timestamp = await time.latest()
      // const stakeData = await stakingERC721.stakes(staker.address);
      // const remainingLockTime = await stakingERC721.connect(staker).getRemainingLockTime();

      // const timePassed = BigInt(timestamp) - (stakeData.unlockTimestamp - config.timeLockPeriod);
      // const stakeTime = stakeData.unlockTimestamp - config.timeLockPeriod;

      // User has staked their remaining NFTs and gained two SNFTs
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(3);
    });
  
    it("Fails to stake when the token id is invalid", async () => {
      // No new token is created, so id is invalid
      await expect(stakingERC721.connect(stakerA).stake(nonMintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
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

      const unlockTimestamp = (await stakingERC721.stakes(stakerB.address)).unlockTimestamp;

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

      const tokenIds = await stakingERC721.connect(stakerA).showAll();

      unstakedAt = BigInt(await time.latest());

      // `stakedOrClaimedAt` is updated in the contract to 0, get the timestamp this way
      
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

    it("Can unstake multiple tokens", async () => {
      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      const tokenIds = await stakingERC721.connect(stakerA).showAll();
      await stakingERC721.connect(stakerA).unstakeAll(false);

      // `stakedOrClaimedAt` is updated in the contract to 0, get the timestamp this way
      const timestamp = BigInt(await time.latest());
      
      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcTotalRewards(
        [timestamp - claimedAt - 1n],
        [balanceAtStakeTwo - 1n],
        config,
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
      
      // User has regained their NFTs and the SNFT was burned
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(3);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(1); // still has tokenIdDelayed staked
      await expect(stakingERC721.ownerOf(tokenIdB)).to.be.revertedWith(INVALID_TOKEN_ID);
      await expect(stakingERC721.ownerOf(tokenIdC)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

  //   it("Fails to unstake when not enough time has passed", async () => {
  //     // Restake to be able to unstake again
  //     await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
  //     await stakingERC721.connect(stakerA).stake(tokenIdA);

  //     await expect(stakingERC721.connect(stakerA).unstake(tokenIdA)).to.be.revertedWithCustomError(stakingERC721, "TimeLockNotPassed");
  //   });

  //   it("Fails to unstake when token id is invalid", async () => {
  //     await expect(stakingERC721.connect(stakerA).unstake(nonMintedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
  //   });

  //   it("Fails to unstake when caller is not the owner of the SNFT", async () => {
  //     await expect(stakingERC721.connect(notStaker).unstake(tokenIdA)).to.be.revertedWithCustomError(stakingERC721, "InvalidOwner");
  //   });

  //   it("Fails to unstake when token id is not staked", async () => {
  //     // If the a token is not staked, the relevant SNFT does not exist and so we can't unstake it
  //     await expect(stakingERC721.connect(stakerA).unstake(nonStakedTokenId)).to.be.revertedWith(INVALID_TOKEN_ID);
  //   });
  });

  // describe("#removeStake | #removeStakeBulk", () => {
  //   // fails if user doesnt own the SNFT
  //   // fails if snft is invalid
  //   it("Fails if the caller does not own the sNFT", async () => {
  //     await expect(stakingERC721.connect(notStaker).exitWithoutRewards(tokenIdA))
  //     .to.be.revertedWithCustomError(stakingERC721, "InvalidOwner");
  //   });

  //   it("Fails if the sNFT is invalid", async () => {
  //     // Because we `burn` on exit, the token would be invalid and it is the same test
  //     // as if the owner has already exited
  //     await expect(stakingERC721.connect(notStaker).exitWithoutRewards(nonMintedTokenId))
  //     .to.be.revertedWith(INVALID_TOKEN_ID);
  //   });

  //   it("Allows the user to remove their stake within the timelock period without rewards", async () => {
  //     // User has staked their NFT and gained an SNFT
  //     expect(await mockERC721.balanceOf(stakerA.address)).to.eq(2); // tokenIdB and TokenIdC
  //     expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(2); // tokenIdA and tokenIdDelayed

  //     const balanceBefore = await mockERC20.balanceOf(stakerA.address);

  //     await stakingERC721.connect(stakerA).exitWithoutRewards(tokenIdA);

  //     const balanceAfter = await mockERC20.balanceOf(stakerA.address);

  //     expect(balanceAfter).to.eq(balanceBefore);
  //     expect(await mockERC721.balanceOf(stakerA.address)).to.eq(3);
  //     expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(1);
  //   });

  //   it("Allows the user to remove multiple stakes within the timelock period without rewards", async () => {
  //     // Stake multiple
  //     await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
  //     await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);
  //     await stakingERC721.connect(stakerA).stakeBulk([tokenIdB, tokenIdC]);

  //     expect(await mockERC721.balanceOf(stakerA.address)).to.eq(1);
  //     expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(3);

  //     const balanceBefore = await mockERC20.balanceOf(stakerA.address);

  //     // Verify we can remove multiple stakes in a single tx
  //     await stakingERC721.connect(stakerA).exitWithoutRewardsBulk([tokenIdB, tokenIdC, tokenIdDelayed]);

  //     const balanceAfter = await mockERC20.balanceOf(stakerA.address);

  //     expect(balanceAfter).to.eq(balanceBefore);
  //     expect(await mockERC721.balanceOf(stakerA.address)).to.eq(4);
  //     expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(0);
  //   });
  // });

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