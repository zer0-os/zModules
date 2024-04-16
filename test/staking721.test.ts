import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MockERC20,
  MockERC721,
  StakingERC721,
} from "../typechain";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  PoolConfig,
} from "./helpers/staking/types";
import { INCORRECT_OWNER_TRANSFER, INVALID_OWNER, INVALID_TOKEN_ID, NO_REWARDS, ONLY_NFT_OWNER, TIME_LOCK_NOT_PASSED } from "./helpers/staking/errors";
import { createDefaultConfigs } from "./helpers/staking/defaults";
import { calcRewardsAmount, calcTotalRewards } from "./helpers/staking/rewards";
import { CLAIMED_EVENT, STAKED_EVENT, UNSTAKED_EVENT } from "./helpers/staking/constants";

describe("StakingERC721", () => {
  let deployer : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
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
  let secondUnstakedAt : bigint;

  let balanceAtStakeOne : bigint;
  let balanceAtStakeTwo : bigint;

  let durationOne : bigint;
  let durationTwo : bigint;

  // Default token ids
  const tokenIdA = 1;
  const tokenIdB = 2;
  const tokenIdC = 3;
  const tokenIdDelayed = 7; // Minted and used in stake at a later point in time
  const nonStakedTokenId = 8; // Minted but never used in `stake`
  const unmintedTokenId = 9; // Never minted

  before(async () => {
    [
      deployer,
      stakerA,
      stakerB,
      stakerC,
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
    it("Allows a user to see the total rewards remaining in a pool", async () => {
      const rewardsInPool = await stakingERC721.getContractRewardsBalance()
      const poolBalance = await mockERC20.balanceOf(await stakingERC721.getAddress());
      expect(rewardsInPool).to.eq(poolBalance);
    });
  });

  describe("#stake", () => {
    it("Can stake an NFT", async () => {
      await stakingERC721.connect(stakerA).stake([tokenIdA]);
      stakedAtA = await (await stakingERC721.stakers(stakerA.address)).lastUpdatedTimestamp;
      balanceAtStakeOne = await stakingERC721.balanceOf(stakerA.address);

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(2); // still has tokenIdB and tokenIdC
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(1);
    });

    it("Can stake multiple NFTs", async () => {
      await stakingERC721.connect(stakerA).stake([tokenIdB, tokenIdC]);
      stakedAtB = await (await stakingERC721.stakers(stakerA.address)).lastUpdatedTimestamp
      stakedAtC = stakedAtB;

      balanceAtStakeTwo = await stakingERC721.balanceOf(stakerA.address);

      // User has staked their remaining NFTs and gained two SNFTs
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(3);
    });
  
    it("Fails to stake when the token id is invalid", async () => {
      // Token is not minted, and so is invalid
      await expect(
        stakingERC721.connect(stakerA).stake([unmintedTokenId])
      ).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  
    it("Fails to stake when the token is already staked", async () => {
      // If the token is staked, the owner will be the staking contract not the original owner
      await expect(
        stakingERC721.connect(stakerA).stake([tokenIdA])
      ).to.be.revertedWith(INCORRECT_OWNER_TRANSFER);  
    });
  
    it("Fails to stake when the caller is not the owner of the NFT", async () => {
      // Staker does not own the token and cannot stake it
      await expect(
        stakingERC721.connect(stakerA).stake([nonStakedTokenId])
      ).to.be.revertedWith(ONLY_NFT_OWNER);
    });
  });

  describe("#getRemainingLockTime", () => {
    it("Allows the user to view the remaining time lock period for a stake", async () => {
      const remainingLockTime = await stakingERC721.connect(stakerA).getRemainingLockTime();
      const latest = await time.latest();

      const stakeData = await stakingERC721.stakers(stakerA.address);

      // Original lock period and remaining lock period time difference should be the same as 
      // the difference between the latest timestamp and that token's stake timestamp 
      expect(remainingLockTime).to.eq((stakeData.unlockTimestamp - BigInt(latest)));
    });

    it("Returns 0 for a staked user that is past their lock time", async () => {
      await time.increase(config.timeLockPeriod);

      const remainingLockTime = await stakingERC721.connect(stakerA).getRemainingLockTime();

      expect(remainingLockTime).to.eq(0n);
    });

    it("Returns 0 for users that have not staked", async () => {
      const remainingLockTime = await stakingERC721.connect(notStaker).getRemainingLockTime();

      expect(remainingLockTime).to.eq(0n);
    })
  });

  describe("#getPendingRewards", () => {
    it("Can view pending rewards for a user", async () => {
      // Move forward in time
      await time.increase(config.periodLength);

      const timestamp = BigInt(await time.latest()); 
      
      durationOne = stakedAtB - stakedAtA;
      durationTwo = timestamp - (stakedAtB);
      
      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      const totalRewards = calcTotalRewards(
        [durationOne, durationTwo],
        [balanceAtStakeOne, balanceAtStakeTwo],
        config
      );

      // Pending rewards on-chain match totalRewards calculated by helper
      expect(pendingRewards).to.eq(totalRewards);
    });

    it ("Returns 0 for users that have not passed a single time period", async () => {
      const tokenId = 5;
      await mockERC721.connect(deployer).mint(stakerB.address, tokenId);
      await mockERC721.connect(stakerB).approve(await stakingERC721.getAddress(), tokenId);

      await stakingERC721.connect(stakerB).stake([tokenId]);
      const pendingRewards = await stakingERC721.connect(stakerB).getPendingRewards();
      expect(pendingRewards).to.eq(0n);
    });

    it("Returns 0 for users that have not staked", async () => {
      const pendingRewards = await stakingERC721.connect(notStaker).getPendingRewards();
      expect(pendingRewards).to.eq(0n);
    });
  });

  describe("#claim", () => {
    it("Can claim rewards when staked and past the timeLockPeriod", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      await stakingERC721.connect(stakerA).claim();

      claimedAt = BigInt(await time.latest());

      // Pending rewards has to be snapshotted before as tx call moves time ahead one extra second
      // before executing the tx, but this means rewards are modified from snapshot so we have to add
      // one extra second of rewards to the pending rewards amount
      const extraSecondRewards = calcRewardsAmount(
        1n,
        balanceAtStakeTwo,
        config
      );

      const expectedRewards = calcTotalRewards(
        [durationOne, claimedAt - stakedAtB],
        [balanceAtStakeOne, balanceAtStakeTwo],
        config
      )

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      // Verify that our calculations must always be in sync with what is on chain
      expect(expectedRewards).to.eq(pendingRewards + extraSecondRewards);

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);

      // Cannot double claim, rewards are reset by timestamp change onchain
      // So calling to `claim` a second time immediately after will only yield the expected
      // return for that amount of time that has passed
      await stakingERC721.connect(stakerA).claim();

      const balanceAfterSecondClaim = await mockERC20.balanceOf(stakerA.address);

      const timestamp = BigInt(await time.latest());
      
      const expectedRewardsClaim2 = calcTotalRewards(
        [timestamp - claimedAt],
        [balanceAtStakeTwo],
        config
      )

      // Update after using in calculation
      claimedAt = BigInt(await time.latest());

      expect(balanceAfterSecondClaim).to.eq(balanceAfter + expectedRewardsClaim2);
    });

    it ("Fails to claim when not enough time has passed", async () => {
      await mockERC721.connect(deployer).mint(stakerC.address, tokenIdDelayed);
      await mockERC721.connect(stakerC).approve(await stakingERC721.getAddress(), tokenIdDelayed);

      await stakingERC721.connect(stakerC).stake([tokenIdDelayed]);

      // The user cannot claim as not enough time has passed
      await expect(
        stakingERC721.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(stakingERC721, TIME_LOCK_NOT_PASSED);
    });

    it("Fails to claim when the caller has no stakes", async () => {
      // Will fail when we check `onlyUnlocked` modifier first
      await expect(
        stakingERC721.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(stakingERC721, TIME_LOCK_NOT_PASSED);
    });
  });

  describe("#unstake", () => {
    it("Can unstake a token", async () => {
      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      // Regular unstake, not calling to "exit"
      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();
      
      await stakingERC721.connect(stakerA).unstake([tokenIdA], false);
      unstakedAt = BigInt(await time.latest());

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      // Timestamp internally is updated before execution
      const extraSecondRewards = calcRewardsAmount(
        1n,
        balanceAtStakeTwo,
        config
      );

      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcTotalRewards(
        [unstakedAt - claimedAt],
        [balanceAtStakeTwo],
        config,
      );

      expect(expectedRewards).to.eq(pendingRewards + extraSecondRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
      
      // User has regained their NFT and the SNFT was burned
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(2);
      await expect(
        stakingERC721.ownerOf(tokenIdA)
      ).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Can unstake multiple staked tokens", async () => {
      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      await stakingERC721.connect(stakerA).unstake([tokenIdB, tokenIdC], false);
      secondUnstakedAt = BigInt(await time.latest());

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      const extraSecondRewards = calcRewardsAmount(
        1n,
        balanceAtStakeTwo - 1n,
        config
      );

      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcTotalRewards(
        [secondUnstakedAt - unstakedAt],
        [balanceAtStakeTwo - 1n],
        config,
      );

      expect(expectedRewards).to.eq(pendingRewards + extraSecondRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
      
      // User has regained their NFTs and the SNFT was burned
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(3);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(0);
      expect((await stakingERC721.stakers(stakerA.address)).numStaked).to.eq(0);

      await expect(stakingERC721.ownerOf(tokenIdB)).to.be.revertedWith(INVALID_TOKEN_ID);
      await expect(stakingERC721.ownerOf(tokenIdC)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to unstake when not enough time has passed", async () => {
      // Restake to be able to unstake again
      await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingERC721.connect(stakerA).stake([tokenIdA]);

      await expect(
        stakingERC721.connect(stakerA).unstake([tokenIdA], false)
      ).to.be.revertedWithCustomError(stakingERC721, TIME_LOCK_NOT_PASSED);
    });

    it("Fails to unstake when token id is invalid", async () => {
      // Move time forward to avoid time lock related errors
      await time.increase(config.timeLockPeriod);
      await expect(
        stakingERC721.connect(stakerA).unstake([unmintedTokenId], false)
      ).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails to unstake when caller is not the owner of the SNFT", async () => {
      // If the user has no stakes, the reversion is by default a `TimeLockNotPassed`,
      // we had stakes here to avoid this path
      await mockERC721.connect(stakerA).transferFrom(stakerA.address, stakerB.address, tokenIdB);
      await mockERC721.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingERC721.connect(stakerB).stake([tokenIdB]);
      await time.increase(config.timeLockPeriod);

      await expect(
        stakingERC721.connect(stakerB).unstake([tokenIdA], false)
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_OWNER);

      // Reset
      await stakingERC721.connect(stakerB).unstake([tokenIdB], false);
    });

    it("Fails to unstake when token id is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist and so we can't unstake it
      await expect(
        stakingERC721.connect(stakerA).unstake([nonStakedTokenId], false)
      ).to.be.revertedWith(INVALID_TOKEN_ID);
    });
  });

  describe("#unstake with 'exit'", () => {
    it("Fails if the caller does not own the sNFT", async () => {
      await expect(
        stakingERC721.connect(notStaker).unstake([tokenIdA], true)
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_OWNER);
    });

    it("Fails if the sNFT is invalid", async () => {
      // Because we `burn` on exit, the token would be invalid and it is the same test
      // as if the owner has already exited
      await expect(
        stakingERC721.connect(notStaker).unstake([unmintedTokenId], true)
      ).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Allows the user to remove their stake within the timelock period without rewards", async () => {
      await mockERC721.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingERC721.connect(stakerB).stake([tokenIdB]);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      await stakingERC721.connect(stakerB).unstake([tokenIdB], true);

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(stakerB.address)).to.eq(1);
      expect(await stakingERC721.balanceOf(stakerB.address)).to.eq(1); // still has delayed token staked
    });

    it("Allows the user to remove multiple stakes within the timelock period without rewards", async () => {
      await mockERC721.connect(stakerB).transferFrom(stakerB.address, stakerA.address, tokenIdB);
      
      // Stake multiple
      // await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      await stakingERC721.connect(stakerA).stake([tokenIdB, tokenIdC]);

      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(3);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      // Verify we can remove multiple stakes in a single tx
      await stakingERC721.connect(stakerA).unstake([tokenIdA, tokenIdB, tokenIdC], true);

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore);
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(3);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(0);
    });
  });

  describe("Events", () => {
    it("Staking emits a 'Staked' event", async () => {
      // Transfer back to staker so they can trigger the `Staked` event
      await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);


      await expect(stakingERC721.connect(stakerA).stake([tokenIdA]))
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(tokenIdA, 1n, 0n, config.stakingToken);

      stakedAtA = BigInt(await time.latest());
      balanceAtStakeOne = await stakingERC721.balanceOf(stakerA.address);
    });

    it("Staking multiple tokens emits multiple 'Staked' events", async () => {
      // Transfer back to staker so they can trigger the `Staked` event
      await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await mockERC721.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      expect(await stakingERC721.connect(stakerA).stake([tokenIdB, tokenIdC]))
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(tokenIdB, 1n, 0n, config.stakingToken)
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(tokenIdC, 1n, 0n, config.stakingToken);

      stakedAtB = BigInt(await time.latest());
      stakedAtC = stakedAtB;

      balanceAtStakeTwo = await stakingERC721.balanceOf(stakerA.address);
    });

    it("Claim emits a 'Claimed' event", async () => {
      await time.increase(config.timeLockPeriod);

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();
      expect(await stakingERC721.connect(stakerA).claim())
        .to.emit(stakingERC721, CLAIMED_EVENT)
        .withArgs(tokenIdA, pendingRewards + 1n, config.rewardsToken);

        claimedAt = BigInt(await time.latest());
    });

    it("Unstake Emits 'Unstaked' and 'Claimed 'events", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);
      
      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      // await stakingERC721.connect(stakerA).unstake([tokenIdA], false);
      await expect(stakingERC721.connect(stakerA).unstake([tokenIdA], false))
        .to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(tokenIdA, 1n, 0n, config.stakingToken)
        .to.emit(stakingERC721, CLAIMED_EVENT)

      // Can't use `.emit` helper when testing Claim as we can't adjust the timestamp the tx
      // use event filter instead
      unstakedAt = BigInt(await time.latest());

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      const extraSecondRewards = calcRewardsAmount(
        1n,
        balanceAtStakeTwo,
        config
      );

      const expectedRewards = calcTotalRewards(
        [unstakedAt - claimedAt],
        [balanceAtStakeTwo],
        config
      );

      expect(expectedRewards).to.eq(pendingRewards + extraSecondRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
    });

    it("Unstaking multiple tokens emits multiple 'Unstaked' and 'Claimed' events", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      expect(await stakingERC721.connect(stakerA).unstake([tokenIdB, tokenIdC], false))
        .to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(tokenIdA, 1n, 0n, config.stakingToken)
        .to.emit(stakingERC721, CLAIMED_EVENT)

      const timestamp = BigInt(await time.latest());
      
      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      const extraSecondRewards = calcRewardsAmount(
        1n,
        balanceAtStakeTwo - 1n,
        config
      );

      const expectedRewards = calcTotalRewards(
        [timestamp - unstakedAt],
        [balanceAtStakeTwo - 1n],
        config
      );

      // Update after calculation
      unstakedAt = BigInt(await time.latest());

      expect(expectedRewards).to.eq(pendingRewards + extraSecondRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
    });
  });
  describe("Other configs", () => {
    it("Can't transfer rewards when no balance", async () => {
      const config = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        poolWeight: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1)
      } as PoolConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        config
      ) as StakingERC721;

      await mockERC721.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      await localStakingERC721.connect(stakerA).stake([tokenIdA]);

      await time.increase(config.timeLockPeriod);

      const rewardsInPool = await localStakingERC721.getContractRewardsBalance();
      expect(rewardsInPool).to.eq(0);

      await expect(
        localStakingERC721.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(stakingERC721, NO_REWARDS)
    })
  });
});





    // TODO use cases
    // user stakes, unstakes, then stakes again in future
      // does the unlock timestamp get changed for the user?
      // if so, people could maybe game this by always having one token in staking
      // so they never have to wait for the timelock again
      // if not, how can we differentiate between a new staker and someone who has staked before
      // but currently has no stakes

    // user stakes, unstakes, then restakes same token
    // user stakes, unstakes, transfers to new user, who then stakes token

  // todo cases
  // 0 checks in stakes and unstakes
  // works with tokenIds = 0 I think
  // cant stake another persons token, fails in ERC721 transfer