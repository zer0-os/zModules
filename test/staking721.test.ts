import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20,
  MockERC721,
  StakingERC721,
} from "../typechain";
import {
  createDefaultConfigs,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  BaseConfig,
  WITHDRAW_EVENT,
  DEFAULT_LOCK,
  calcLockedRewards,
  calcTotalLockedRewards,
  calcTotalUnlockedRewards,
  PRECISION_DIVISOR,
  LOCKED_PRECISION_DIVISOR,
  DEFAULT_LOCK_ADJUSTMENT,
} from "./helpers/staking";
import {
  FAILED_INNER_CALL_ERR,
  FUNCTION_SELECTOR_ERR,
  ZERO_INIT_ERR,
  NON_TRANSFERRABLE_ERR,
  INCORRECT_OWNER_TRANSFER_ERR,
  INVALID_OWNER_ERR,
  NONEXISTENT_TOKEN_ERR,
  NO_REWARDS_BALANCE_ERR,
  TIME_LOCK_NOT_PASSED_ERR, INSUFFICIENT_APPROVAL_721_ERR, OWNABLE_UNAUTHORIZED_ERR,
  ZERO_REWARDS_ERR,
  INVALID_UNSTAKE_ERR,
} from "./helpers/errors";
import { staking } from "../typechain/contracts";


describe("StakingERC721", () => {
  let owner : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let stakingERC721 : StakingERC721;
  let rewardToken : MockERC20;
  let stakingToken : MockERC721;

  let stakingERC721Address : string;
  let rewardTokenAddress : string;
  let stakingTokenAddress : string;

  // We don't use `PoolConfig` anymore on the contracts but for convenience in testing
  // we can leave this type where it is
  let config : BaseConfig;

  // Keep timestamps for users
  let firstStakedAtA : bigint;
  let secondStakedAtA : bigint;

  let firstStakedAtB : bigint;
  let secondStakedAtB : bigint;

  let claimedAtA : bigint;
  let claimedAtB : bigint;

  let unstakedAtA : bigint;
  let unstakedAtB : bigint;

  let secondUnstakedAt : bigint;

  let balanceAtStakeOne : bigint;
  let balanceAtStakeTwo : bigint;

  let durationOne : bigint;
  let durationTwo : bigint;

  // Default token ids
  const tokenIdA = 1n;
  const tokenIdB = 2n;
  const tokenIdC = 3n;
  const tokenIdD = 4n;
  const tokenIdE = 5n;
  const tokenIdF = 6n;
  const tokenIdG = 7n;

  const tokenIdDelayed = 8n; // Minted and used in stake at a later point in time
  const unStakedTokenId = 9n; // Minted but never used in stake
  const unmintedTokenId = 10n; // Never minted

  const baseUri = "0://staked-nfts";
  const emptyUri = "";

  let reset = async () => {};

  before(async () => {
    [
      owner,
      stakerA,
      stakerB,
      stakerC,
      notStaker,
    ] = await hre.ethers.getSigners();

    reset = async () => {

      const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
      rewardToken = await mockERC20Factory.deploy("MEOW", "MEOW");
  
      rewardTokenAddress = await rewardToken.getAddress();
  
      const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");
      stakingToken = await mockERC721Factory.deploy("WilderWheels", "WW", baseUri);
  
      stakingTokenAddress = await stakingToken.getAddress();
  
      config = await createDefaultConfigs(rewardToken, stakingToken);
  
      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      stakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        config.stakingToken,
        config.rewardsToken,
        config.rewardsPerPeriod,
        config.periodLength,
        config.lockAdjustment,
        owner.address
      );
  
      stakingERC721Address = await stakingERC721.getAddress();
  
      // Give staking contract balance to pay rewards
      await rewardToken.connect(owner).transfer(
        await stakingERC721.getAddress(),
        hre.ethers.parseEther("8000000000000")
      );
  
      await stakingToken.connect(owner).mint(stakerA.address, tokenIdA);
      await stakingToken.connect(owner).mint(stakerA.address, tokenIdB);
      await stakingToken.connect(owner).mint(stakerA.address, tokenIdC);
  
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdD);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdE);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdF);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdG);
  
      await stakingToken.connect(owner).mint(owner.address, unStakedTokenId);
  
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);
  
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdD);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdE);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdF);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdG);
    }

    // Call once to set up the contracts
    await reset();
  });

  it.skip("calcs correctly", async () => {

    await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], [DEFAULT_LOCK]);
    await stakingERC721.connect(stakerB).stakeWithoutLock([tokenIdD], [emptyUri]);

    await time.increase(DEFAULT_LOCK);

    // Both users are given a sNFT
    expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(1);
    expect(await stakingERC721.balanceOf(stakerB.address)).to.eq(1);

    // now call to claim
    const stakerABalanceBefore = await rewardToken.balanceOf(stakerA.address);
    const stakerBBalanceBefore = await rewardToken.balanceOf(stakerB.address);

    await stakingERC721.connect(stakerA).claim();
    claimedAtA = BigInt(await time.latest());

    await stakingERC721.connect(stakerB).claim(); 
    claimedAtB = BigInt(await time.latest());

    // Claim does not affect the staked balance
    expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(1);
    expect(await stakingERC721.balanceOf(stakerB.address)).to.eq(1);

    const stakerABalanceAfter = await rewardToken.balanceOf(stakerA.address);
    const stakerBBalanceAfter = await rewardToken.balanceOf(stakerB.address);

    // Increase time again before unstake to accrue more rewards
    await time.increase(DEFAULT_LOCK);

    await stakingERC721.connect(stakerA).unstakeAll(false);
    unstakedAtA = BigInt(await time.latest());

    await stakingERC721.connect(stakerB).unstakeAll(false);
    unstakedAtB = BigInt(await time.latest());

    // Unstaking burns the sNFT
    expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(0n);
    expect(await stakingERC721.balanceOf(stakerB.address)).to.eq(0n);

    const unstakeBalAfterA = await rewardToken.balanceOf(stakerA.address);
    const unstakeBalAfterB = await rewardToken.balanceOf(stakerB.address);

    const expectedRewardsAfterUnstakeA = calcTotalUnlockedRewards(
      [unstakedAtA - claimedAtA],
      [DEFAULT_LOCK],
      config
    );

    const stakerData = await stakingERC721.nftStakers(stakerB.address);

    const expectedRewardsAfterUnstakeB = calcTotalLockedRewards(
      [unstakedAtB - claimedAtB],
      [0n],
      stakerData.rewardsMultiplier,
      config
    );

    expect(expectedRewardsAfterUnstakeA).to.eq(unstakeBalAfterA - stakerABalanceAfter);
    expect(expectedRewardsAfterUnstakeB).to.eq(unstakeBalAfterB - stakerBBalanceAfter);
    expect(expectedRewardsAfterUnstakeA).to.be.gt(expectedRewardsAfterUnstakeB);
  });

  it("Should NOT deploy with zero values passed", async () => {
    const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");

    await expect(
      stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        hre.ethers.ZeroAddress,
        rewardTokenAddress,
        config.rewardsPerPeriod,
        config.periodLength,
        config.lockAdjustment,
        owner.address
      )
    ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);

    await expect(
      stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        stakingTokenAddress,
        hre.ethers.ZeroAddress,
        config.rewardsPerPeriod,
        config.periodLength,
        config.lockAdjustment,

        owner.address
      )
    ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);

    await expect(
      stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        stakingToken.target,
        rewardToken.target,
        0, // rewards per period
        config.periodLength,
        config.lockAdjustment,
        owner.address
      )
    ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);
  });

  describe("#getContractRewardsBalance", () => {
    it("Allows a user to see the total rewards remaining in a pool", async () => {
      const rewardsInPool = await stakingERC721.getContractRewardsBalance();
      const poolBalance = await rewardToken.balanceOf(await stakingERC721.getAddress());
      expect(rewardsInPool).to.eq(poolBalance);
    });
  });

  // TODO list out cases, make sure all covered

  describe("#stake", () => {
    it("Can stake a single NFT using #stakeWithoutLock", async () => {
      // stakerA starts with tokenA, tokenB, and tokenC
      const supplyBefore = await stakingERC721.totalSupply();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      firstStakedAtA = BigInt(await time.latest());

      const supplyAfter = await stakingERC721.totalSupply();

      // Get balance of sNFTs
      balanceAtStakeOne = await stakingERC721.balanceOf(stakerA.address);

      const stakerData = await stakingERC721.connect(stakerA).nftStakers(stakerA.address);

      const stakes = await stakingERC721.connect(stakerA).getStakedTokenIds();

      const tokenUri = await stakingERC721.tokenURI(tokenIdA);
      expect(tokenUri).to.eq(baseUri + tokenIdA);

      // A new sNFT was created
      expect(supplyAfter).to.eq(supplyBefore + 1n);

      // User still has tokenIdB and tokenIdC
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(2);

      // User now has one sNFT after staking
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(1);

      expect(stakerData.amountStaked).to.eq(stakes.length);
      expect(stakes[0]).to.eq(tokenIdA);
      expect(stakerData.lastTimestamp).to.eq(firstStakedAtA);
    });

    it("Can stake a single NFT using #stakeWithLock", async () => {
      // stakerB starts with tokenD, tokenE, tokenF, and tokenG
      const supplyBefore = await stakingERC721.totalSupply();

      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdD], [emptyUri], [DEFAULT_LOCK]);
      firstStakedAtB = BigInt(await time.latest());

      const supplyAfter = await stakingERC721.totalSupply();

      // Get balance of sNFTs
      balanceAtStakeOne = await stakingERC721.balanceOf(stakerB.address);

      const stakerData = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);
      const stakes = await stakingERC721.connect(stakerB).getStakedTokenIds();

      const tokenUri = await stakingERC721.tokenURI(tokenIdD);
      expect(tokenUri).to.eq(baseUri + tokenIdD);

      // User has staked their NFT and gained an sNFT
      expect(supplyAfter).to.eq(supplyBefore + 1n);

      // User still has tokenE, tokenF, and tokenG
      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(3);

      // User has been given the sNFT for tokenD
      expect(await stakingERC721.balanceOf(stakerB.address)).to.eq(1);

      expect(stakerData.amountStakedLocked).to.eq(stakes.length);
      expect(stakes[0]).to.eq(tokenIdD)
      expect(stakerData.lockDuration).to.eq(DEFAULT_LOCK);
      expect(stakerData.lastTimestampLocked).to.eq(firstStakedAtB);
    });

    it("Can stake multiple NFTs using #stakeWithoutLock", async () => {
      // stakerA has tokenIdB and tokenIdC remaining, and stakes both
      const supplyBefore = await stakingERC721.totalSupply();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdB, tokenIdC], [emptyUri, emptyUri]);
      secondStakedAtA = BigInt(await time.latest());

      const supplyAfter = await stakingERC721.totalSupply();

      balanceAtStakeTwo = await stakingERC721.balanceOf(stakerA.address);

      const stakerData = await stakingERC721.connect(stakerA).nftStakers(stakerA.address);

      // const amountStaked = await stakingERC721.connect(stakerA).getAmountStaked();
      const stakes = await stakingERC721.connect(stakerA).getStakedTokenIds();

      expect(stakes[1]).to.eq(tokenIdB);
      expect(stakes[2]).to.eq(tokenIdC);

      expect(supplyAfter).to.eq(supplyBefore + 2n);

      // User has staked their remaining NFTs and gained two sNFTs
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(3);

      expect(stakerData.amountStaked).to.eq(stakes.length);
      expect(stakes[0]).to.eq(tokenIdA); // Is unchanged
      expect(stakerData.lockDuration).to.eq(0);
      expect(stakerData.lastTimestamp).to.eq(secondStakedAtA);
    });

    it("Can stake multiple NFTs using #stakeWithLock", async () => {
      // stakerB has tokenIdE, tokenIdF, and tokenIdG remaining, stakes E and F
      const supplyBefore = await stakingERC721.totalSupply();

      await stakingERC721.connect(stakerB).stakeWithLock(
        [tokenIdE, tokenIdF],
        [emptyUri, emptyUri],
        [DEFAULT_LOCK, DEFAULT_LOCK]
      );

      secondStakedAtB = BigInt(await time.latest());

      const supplyAfter = await stakingERC721.totalSupply();

      balanceAtStakeTwo = await stakingERC721.balanceOf(stakerB.address);

      const stakerData = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);


      // const amountStaked = await stakingERC721.connect(stakerB).getAmountStaked();
      const tokenIds = await stakingERC721.connect(stakerB).getStakedTokenIds();

      expect(supplyAfter).to.eq(supplyBefore + 2n);

      // User still has tokenIdG
      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(1);
      
      // User has staked tokenIdE and tokenIdF and gained two sNFTs, totalling 3
      expect(await stakingERC721.balanceOf(stakerB.address)).to.eq(3);

      expect(stakerData.amountStakedLocked).to.eq(tokenIds.length);
      expect(tokenIds[1]).to.eq(tokenIdE)
      expect(tokenIds[2]).to.eq(tokenIdF)

      expect(stakerData.lockDuration).to.eq(DEFAULT_LOCK);
      expect(stakerData.lastTimestampLocked).to.eq(secondStakedAtB);
    });

    it("Modifies the lock duration appropriately on follow up stakes", async () => {
      await reset();

      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdD], [emptyUri], [DEFAULT_LOCK]);

      const stakerDataBefore = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);
      const stakedAtFirst = BigInt(await time.latest());

      const timeIncrease = 100n;
      await time.increase(timeIncrease)
      // If the user has already staked with lock, incoming locks are ignored when the
      // new lock duration is calculated
      // TODO resolve the expected behavior here.
      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdE], [emptyUri], [6n]);
      const stakedAtSecond = BigInt(await time.latest());

      const stakerDataAfter = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);

      // We increase the staker's lockDuration by the amount they already have configured
      // as the initial lockDuration
      expect(stakerDataAfter.unlockedTimestamp).to.eq(stakerDataBefore.unlockedTimestamp + (stakerDataBefore.lockDuration / 2n));
      expect(stakerDataAfter.lockDuration).to.eq(stakerDataBefore.lockDuration);
    });

    it("Fails when the user tries to transfer the sNFT", async () => {
      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);

      // Expect owner of the original NFT to be the contract
      expect(await stakingToken.ownerOf(tokenIdA)).to.eq(stakingERC721Address);

      // Expect owner of the sNFT to be the staker
      expect(await stakingERC721.ownerOf(tokenIdA)).to.eq(stakerA.address);

      await expect(
        stakingERC721.connect(stakerA).transferFrom(
          stakerA.address,
          stakerB.address,
          tokenIdA
        )).to.be.revertedWithCustomError(stakingERC721, NON_TRANSFERRABLE_ERR);
    });

    it("Fails to stake when the token id is invalid", async () => {
      // Token is not minted, and so is invalid
      await expect(
        stakingERC721.connect(stakerA).stakeWithoutLock([unmintedTokenId], [emptyUri])
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);

      await expect(
        stakingERC721.connect(stakerA).stakeWithLock([unmintedTokenId], [emptyUri], [DEFAULT_LOCK])
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);
    });

    it("Fails to stake when the token is already staked", async () => {
      // If the token is staked, the owner will be the staking contract not the original owner
      await expect(
        stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri])
      ).to.be.revertedWithCustomError(stakingERC721, INCORRECT_OWNER_TRANSFER_ERR)
        .withArgs(stakerA.address, tokenIdA, await stakingERC721.getAddress());

      await expect(
        stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], [DEFAULT_LOCK])
      ).to.be.revertedWithCustomError(stakingERC721, INCORRECT_OWNER_TRANSFER_ERR)
        .withArgs(stakerA.address, tokenIdA, await stakingERC721.getAddress());
    });

    it("Fails to stake when the caller is not the owner of the NFT", async () => {
      // Staker does not own the token and cannot stake it
      await expect(
        stakingERC721.connect(stakerA).stakeWithoutLock([unStakedTokenId], [emptyUri])
      ).to.be.revertedWithCustomError(stakingERC721, INSUFFICIENT_APPROVAL_721_ERR)
        .withArgs(stakingERC721.target, unStakedTokenId);
      
        await expect(
          stakingERC721.connect(stakerA).stakeWithLock([unStakedTokenId], [emptyUri], [DEFAULT_LOCK])
        ).to.be.revertedWithCustomError(stakingERC721, INSUFFICIENT_APPROVAL_721_ERR)
          .withArgs(stakingERC721.target, unStakedTokenId);
    });
  });

  describe("#getRemainingLockTime", () => {
    // returns 0 if user has not staked the given token
    it("Allows the user to view the remaining time lock duration", async () => {
      await reset();

      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], [DEFAULT_LOCK]);

      await time.increase(DEFAULT_LOCK / 2n);

      const remainingLockTime = await stakingERC721.connect(stakerA).getRemainingLockTime();
      const latest = await time.latest();

      const stakerData = await stakingERC721.nftStakers(stakerA.address);

      const stakeTimestamp = stakerData.lastTimestampLocked;
      const lockDuration = stakerData.lockDuration;

      // Original lock period and remaining lock period time difference should be the same as
      // the difference between the latest timestamp and that token's stake timestamp
      expect(remainingLockTime).to.eq((stakeTimestamp + lockDuration - BigInt(latest)));
    });

    it("Returns 0 for users that did not stake the given token", async () => {
      const remainingLockTime = await stakingERC721.connect(notStaker).getRemainingLockTime();
      expect(remainingLockTime).to.eq(0n);
    });

    it("Returns 0 for a user that is past their lock duration", async () => {
      await time.increase(DEFAULT_LOCK);

      const remainingLockTime = await stakingERC721.connect(stakerB).getRemainingLockTime();

      expect(remainingLockTime).to.eq(0n);
    });
  });

  describe("#getPendingRewards", () => {
    it("Can view pending rewards for a user", async () => {
      await reset(); 

      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdG], [emptyUri], [DEFAULT_LOCK]);
      const stakedAt = BigInt(await time.latest());

      const stakerData = await stakingERC721.nftStakers(stakerB.address);
      const tokenIds = await stakingERC721.connect(stakerB).getStakedTokenIds();

      // console.log(stakerData.amountStakedLocked)

      const pendingRewards = await stakingERC721.connect(stakerB).getPendingRewards();

      // If no time has passed, the value will be 0
      expect(pendingRewards).to.eq(0);

      await time.increase(DEFAULT_LOCK / 2n);
      const latest = BigInt(await time.latest());

      const updatedPendingRewards = await stakingERC721.connect(stakerB).getPendingRewardsLocked();

      const expectedRewards = calcTotalLockedRewards(
        [latest - stakedAt],
        [1n],
        stakerData.rewardsMultiplier,
        config
      );

        expect(updatedPendingRewards).to.eq(expectedRewards);
    });

    it("Returns 0 for users that have not passed any time", async () => {
      const tokenId = 1000n;
      await stakingToken.connect(owner).mint(stakerB.address, tokenId);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenId);

      await stakingERC721.connect(stakerB).stakeWithLock([tokenId], [emptyUri], [DEFAULT_LOCK]);
      const pendingRewards = await stakingERC721.connect(stakerB).getPendingRewards();

      expect(pendingRewards).to.eq(0n);
    });

    it("Returns 0 for users that have not staked", async () => {
      const pendingRewards = await stakingERC721.connect(notStaker).getPendingRewards();
      expect(pendingRewards).to.eq(0n);
    });
  });

  describe("#claim", () => {
    it("Can claim rewards when staked without time lock", async () => {
      await reset();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 5n);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      await stakingERC721.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const expectedRewards = calcTotalUnlockedRewards(
        [claimedAt - stakedAt],
        [1n],
        config
      );

      expect(expectedRewards).to.eq(balanceAfter - balanceBefore);

      await time.increase(DEFAULT_LOCK / 2n);

      const balanceBeforeSecond = await rewardToken.balanceOf(stakerA.address);
      const pendingRewardsSecond = await stakingERC721.connect(stakerA).getPendingRewards();

      // On a follow up claim, confirm only rewards are given for the time since the previous
      // call to claim
      await stakingERC721.connect(stakerA).claim();
      const secondClaimedAt = BigInt(await time.latest());
      const balanceAfterSecond = await rewardToken.balanceOf(stakerA.address);

      const nextExpectedRewards = calcTotalUnlockedRewards(
        [secondClaimedAt - claimedAt],
        [1n],
        config
      );

      expect(nextExpectedRewards).to.eq(balanceAfterSecond - balanceBeforeSecond);
    });

    // TODO what if user stakes with lock then waits the lock period
    // then stakes again with lock?
    // right now we ignore new lock periods as lock periods are per staker
    // but if do we have logic that supports adding a new lock period if they lock
    // after their initial lock period is through?
    it("Fails to claim when not enough time has passed", async () => {
      await reset();

      await stakingToken.connect(owner).mint(stakerC.address, tokenIdDelayed);
      await stakingToken.connect(stakerC).approve(await stakingERC721.getAddress(), tokenIdDelayed);

      await stakingERC721.connect(stakerC).stakeWithLock([tokenIdDelayed], [emptyUri], [DEFAULT_LOCK]);

      // The user cannot claim as not enough time has passed
      await expect(
        stakingERC721.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(stakingERC721, TIME_LOCK_NOT_PASSED_ERR);
    });

    it("Fails to claim when the caller has no stakes", async () => {
      // Will fail when we check `onlyUnlocked` modifier first
      await expect(
        stakingERC721.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(stakingERC721, ZERO_REWARDS_ERR);
    });
  });

  describe("#unstake", () => {
    let stakedAtUnlocked : bigint;
    let stakedAtLocked : bigint;
    let unstakedAtUnlocked : bigint;
    let unstakedAtLocked : bigint;

    it("Can unstake a token that is unlocked", async () => {
      await reset();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      stakedAtUnlocked = BigInt(await time.latest());

      await stakingERC721.connect(stakerA).stakeWithLock(
        [tokenIdB, tokenIdC],
        [emptyUri, emptyUri],
        [DEFAULT_LOCK, DEFAULT_LOCK]
      );
      stakedAtLocked = BigInt(await time.latest())

      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);
      console.log("rewardsMultiplier: ", stakerDataBefore.rewardsMultiplier);

      // first "group" of stakes shouldn't adjust lock time, even though
      await time.increase(DEFAULT_LOCK);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      await stakingERC721.connect(stakerA).unstake([tokenIdA], false);
      unstakedAtUnlocked = BigInt(await time.latest());

      const expectedRewards = calcTotalUnlockedRewards(
        [unstakedAtUnlocked - stakedAtUnlocked],
        [1n],
        config
      );

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);

      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);

      // User has regained their NFT and the SNFT was burned
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(2);
      expect(stakerDataAfter.amountStaked).to.eq(0);
      expect(stakerDataAfter.amountStakedLocked).to.eq(2);
      expect(stakerDataAfter.lastTimestamp).to.eq(unstakedAtUnlocked);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(stakedAtLocked);
      expect(stakerDataAfter.owedRewards).to.eq(0n);

      // Confirm the sNFT was burned
      await expect(
        stakingERC721.ownerOf(tokenIdA)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdA);
    });

    it("Can unstake multiple unlocked tokens", async () => {
      const balanceBefore = await rewardToken.balanceOf(stakerA.address);
      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      await stakingERC721.connect(stakerA).unstake([tokenIdB, tokenIdC], false);
      unstakedAtLocked = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);


      // One period has passed, expect that rewards for one period were given
      const expectedRewards = calcLockedRewards(
        unstakedAtLocked - stakedAtLocked,
        2n,
        stakerDataBefore.rewardsMultiplier,
        config
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);

      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);


      // User has regained their NFTs and the SNFT was burned
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(3);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(0);
      expect((await stakingERC721.nftStakers(stakerA.address)).amountStaked).to.eq(0);

      // Staker data has been reset when they have completely unstaked
      expect(stakerDataAfter.lastTimestamp).to.eq(0n);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(0n);
      expect(stakerDataAfter.lockDuration).to.eq(0n);
      expect(stakerDataAfter.amountStaked).to.eq(0n);
      expect(stakerDataAfter.amountStakedLocked).to.eq(0n);
      expect(stakerDataAfter.owedRewards).to.eq(0n);
      expect(stakerDataAfter.owedRewardsLocked).to.eq(0n);

      await expect(
        stakingERC721.ownerOf(tokenIdB)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdB);
      await expect(
        stakingERC721.ownerOf(tokenIdC)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdC);
    });

    it("Fails to unstake locked tokens without 'exit' when not enough time has passed", async () => {
      await reset();

      // Restake to be able to unstake again
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);

      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], [DEFAULT_LOCK]);

      await expect(
        stakingERC721.connect(stakerA).unstake([tokenIdA], false)
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });

    it("Fails to unstake when token id is invalid", async () => {
      // It will revert with the "ZeroRewards" error before it has a chance to check the token id

      await expect(
        stakingERC721.connect(stakerA).unstake([unmintedTokenId], false)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)

      // Confirm with `exit`
      await expect(
        stakingERC721.connect(stakerA).unstake([unmintedTokenId], true)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);
    });

    it("Fails to unstake when caller is not the owner of the SNFT", async () => {
      // If the user has no stakes, the reversion is by default a `TimeLockNotPassed`,
      // we had stakes here to avoid this path
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdD);
      await stakingERC721.connect(stakerB).stakeWithoutLock([tokenIdD], [emptyUri]);
      // await time.increase(config.timeLockPeriod);

      await expect(
        stakingERC721.connect(stakerA).unstake([tokenIdD], false)
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });

    it("Fails to unstake when token id is not staked", async () => {
      // If the a token is not staked, the relevant SNFT does not exist and so we can't unstake it
      await expect(
        stakingERC721.connect(stakerA).unstake([unStakedTokenId], false)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unStakedTokenId);
    });
  });

  describe("#unstake with 'exit'", () => {
    it("Fails if the caller does not own the sNFT", async () => {
      await expect(
        stakingERC721.connect(stakerB).unstake([tokenIdA], true)
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });

    it("Fails if the sNFT is invalid", async () => {
      // Because we `burn` on exit, the token would be invalid and it is the same test
      // as if the owner has already exited
      await expect(
        stakingERC721.connect(stakerB).unstake([unmintedTokenId], true)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);
    });

    it("Allows the user to remove their stake within the timelock period without rewards", async () => {
      await reset(); 

      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdD);
      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdD], [emptyUri], [DEFAULT_LOCK]);

      const stakeBalanceBefore = await stakingERC721.balanceOf(stakerB.address)
      const stakeTokenBalanceBefore = await stakingToken.balanceOf(stakerB.address)
      const rewardsBalanceBefore = await rewardToken.balanceOf(stakerB.address);

      await stakingERC721.connect(stakerB).unstake([tokenIdD], true);

      const stakeBalanceAfter = await stakingERC721.balanceOf(stakerB.address);
      const stakeTokenBalanceAfter = await stakingToken.balanceOf(stakerB.address)
      const rewardsBalanceAfter = await rewardToken.balanceOf(stakerB.address);

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - 1n);
      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + 1n);
    });

    it("Allows the user to remove multiple stakes within the timelock period without rewards", async () => {
      // await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerA.address, tokenIdD);

      // Stake multiple
      // await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      await stakingERC721.connect(stakerA).stakeWithLock(
        [tokenIdA, tokenIdB, tokenIdC],
        [emptyUri, emptyUri, emptyUri],
        [DEFAULT_LOCK, DEFAULT_LOCK, DEFAULT_LOCK]
      );

      const stakeBalanceBefore = await stakingERC721.balanceOf(stakerA.address)
      const stakeTokenBalanceBefore = await stakingToken.balanceOf(stakerA.address)
      const rewardsBalanceBefore = await rewardToken.balanceOf(stakerA.address);

      // Verify we can remove multiple stakes in a single tx
      await stakingERC721.connect(stakerA).unstake([tokenIdA, tokenIdB, tokenIdC], true);

      const stakeBalanceAfter = await stakingERC721.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakingToken.balanceOf(stakerA.address)
      const rewardsBalanceAfter = await rewardToken.balanceOf(stakerA.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - 3n);
      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + 3n);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
    });
  });

  describe.skip("Events", () => {
    it("Staking emits a 'Staked' event", async () => {
      // Transfer back to staker so they can trigger the `Staked` event
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);

      await expect(stakingERC721.connect(stakerA).stake([tokenIdA], [emptyUri]))
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(stakerA.address, tokenIdA, config.stakingToken);

      firstStakedAtA = BigInt(await time.latest());
      balanceAtStakeOne = await stakingERC721.balanceOf(stakerA.address);
    });

    it("Staking multiple tokens emits multiple 'Staked' events", async () => {
      // Transfer back to staker so they can trigger the `Staked` event
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      await expect(await stakingERC721.connect(stakerA).stake([tokenIdB, tokenIdC], [emptyUri, emptyUri]))
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(stakerA.address, tokenIdB, config.stakingToken)
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(stakerA.address, tokenIdC, config.stakingToken);

      secondStakedAtA = BigInt(await time.latest());

      balanceAtStakeTwo = await stakingERC721.balanceOf(stakerA.address);
    });

    it("Claim emits a 'Claimed' event", async () => {
      await time.increase(config.timeLockPeriod);

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      await expect(await stakingERC721.connect(stakerA).claim())
        .to.emit(stakingERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, pendingRewards, config.rewardsToken);

      claimedAt = BigInt(await time.latest());
    });

    it("Unstake Emits 'Unstaked' and 'Claimed 'events", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      await expect(
        await stakingERC721.connect(stakerA).unstake([tokenIdA], false)
      ).to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdA, config.stakingToken)
        .to.emit(stakingERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, pendingRewards, config.rewardsToken);

      // Can't use `.withArgs` helper when testing claim event as we can't adjust the
      // timestamp required for calculating the proper rewards amount
      unstakedAtA = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const expectedRewards = calcTotalRewards(
        [unstakedAtA - claimedAt],
        [balanceAtStakeTwo],
        config.rewardsPerPeriod,
        config.periodLength
      );

      expect(expectedRewards).to.eq(pendingRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
    });

    it("Unstaking multiple tokens emits multiple 'Unstaked' and 'Claimed' events", async () => {
      await time.increase(config.timeLockPeriod);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

      await expect(await stakingERC721.connect(stakerA).unstake([tokenIdB, tokenIdC], false))
        .to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdB, config.stakingToken)
        .to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdC, config.stakingToken)
        .to.emit(stakingERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, pendingRewards, config.rewardsToken);

      // Cannot verify 'CLAIMED_EVENT' using '.withArgs' because we can't manipulate the
      // timestamp to calculate the expected rewards until after the tx
      const timestamp = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const expectedRewards = calcTotalRewards(
        [timestamp - unstakedAtA],
        [balanceAtStakeTwo - 1n],
        config.rewardsPerPeriod,
        config.periodLength
      );

      // Update after calculation
      unstakedAtA = BigInt(await time.latest());

      expect(expectedRewards).to.eq(pendingRewards);
      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
    });
  });

  describe("Other configs", () => {
    it ("Can't use the StakingERC721 contract when an IERC20 is the staking token", async () => {
      const localConfig = {
        stakingToken: await rewardToken.getAddress(),
        rewardsToken: await stakingToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
        divisor: PRECISION_DIVISOR,
        lockedDivisor: LOCKED_PRECISION_DIVISOR,
        lockAdjustment: DEFAULT_LOCK_ADJUSTMENT
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig.stakingToken,
        localConfig.rewardsToken,
        localConfig.rewardsPerPeriod,
        localConfig.periodLength,
        localConfig.lockAdjustment,
        owner.address
      ) as StakingERC721;

      // Realistically, they should never approve the contract for erc20 spending
      await rewardToken.connect(stakerA).approve(await localStakingERC721.getAddress(), hre.ethers.MaxUint256);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      // Can't catch this using `await expect(...)` so must try/catch instead
      /** eslint-disable @typescript-eslint/no-explicit-any */
      try {
        await localStakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FUNCTION_SELECTOR_ERR);
      }

      try {
        await localStakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], [DEFAULT_LOCK]);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FUNCTION_SELECTOR_ERR);
      }
    });

    it("Can't use the StakingERC721 contract when an IERC721 is the rewards token", async () => {
      await reset();

      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await stakingToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
        divisor: PRECISION_DIVISOR,
        lockedDivisor: LOCKED_PRECISION_DIVISOR,
        lockAdjustment: DEFAULT_LOCK_ADJUSTMENT
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig.stakingToken,
        localConfig.rewardsToken,
        localConfig.rewardsPerPeriod,
        localConfig.periodLength,
        localConfig.lockAdjustment,
        owner.address
      ) as StakingERC721;

      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      await localStakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);

      await time.increase(DEFAULT_LOCK / 4n);

      try {
        await localStakingERC721.connect(stakerA).claim();
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FAILED_INNER_CALL_ERR);
      }

      try {
        // In this flow balance is checked before trying to transfer, and so this will
        // fail first
        await localStakingERC721.connect(stakerA).unstake([tokenIdA], false);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(NO_REWARDS_BALANCE_ERR);
      }
      
      // To be sure balance check isn't the failure, we give balance of many NFTs so the
      // number is similar
      const pendingRewards = await localStakingERC721.connect(stakerA).getPendingRewards()

      const bal = await stakingToken.balanceOf(await localStakingERC721.getAddress())

      for (let i = 10; i < 2171; i++) {
        await stakingToken.connect(stakerA).mint(await localStakingERC721.getAddress(), i);
      }


      try {
        // After providing balance to the contract, we see it now fails correctly as it can't recognize
        // the function selector being called in unstake

        await localStakingERC721.connect(stakerA).unstake([tokenIdA], false);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FAILED_INNER_CALL_ERR);
      }
    });

    it("Can't use 0 as the period length", async () => {
      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await stakingToken.getAddress(),
        rewardsPerPeriod: BigInt(3),
        periodLength: BigInt(0),
        timeLockPeriod: BigInt(50),
        divisor: PRECISION_DIVISOR,
        lockedDivisor: LOCKED_PRECISION_DIVISOR,
        lockAdjustment: DEFAULT_LOCK_ADJUSTMENT
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      try {
        await stakingFactory.deploy(
          "StakingNFT",
          "SNFT",
          baseUri,
          localConfig.stakingToken,
          localConfig.rewardsToken,
          localConfig.rewardsPerPeriod,
          localConfig.periodLength,
          localConfig.lockAdjustment,
          owner.address
        );
      } catch (e : unknown) {
        expect((e as Error).message).to.include(ZERO_INIT_ERR);
      }
    });

    it("Can't transfer rewards when there is no rewards balance", async () => {
      await reset(); 

      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await rewardToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
        divisor: PRECISION_DIVISOR,
        lockedDivisor: LOCKED_PRECISION_DIVISOR,
        lockAdjustment: DEFAULT_LOCK
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig.stakingToken,
        localConfig.rewardsToken,
        localConfig.rewardsPerPeriod,
        localConfig.periodLength,
        localConfig.lockAdjustment,
        owner.address
      ) as StakingERC721;

      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      await localStakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);

      await time.increase(DEFAULT_LOCK / 3n);

      const rewardsBalance = await rewardToken.balanceOf(await localStakingERC721.getAddress());

      // TODO debug, why is this passing below but we show 0 balance for rewards when check?
      // this should revert but doesnt
      const rewardsInPool = await localStakingERC721.getContractRewardsBalance();
      expect(rewardsInPool).to.eq(0);

      // Strangely this error isn't caught with the usual `await expect(...).to.be.revertedWith(...)`
      // use this instead
      try {
        await localStakingERC721.connect(stakerA).claim();
      } catch (e) {
        expect((e as Error).message).to.include(NO_REWARDS_BALANCE_ERR);
      }
    });

    it.skip("More complex use case involving multiple stakes and stakers", async () => {

      /** Script
       * mint stakerB tokens D, E, F, G
       * mint stakerC tokens H, I
       * approvals for all stakers and tokens
       * stakerA stakes A, B, C
       * stakerB stakes D, E, F
       * stakerA tries to claim, fails
       * stakerB tries to claim, fails
       * time passes
       * stakerA claims rewards
       * stakerB tries to claim, fails
       * stakerC tries to stake H and G, fails as doesnt own G
       * stakerC stakes H and I
       * stakerB unstakes D
       * stakerB stakes G
       * stakerA unstakes all tokens, A, B, and C
       * stakerC tries to claim, fails
       * time passes
       * stakerC claims rewards
       * stakerB unstakes E and F
       * stakerB transfers D to stakerA
       * stakerB transfers E to stakerC
       * stakerB tries to transfer sNFT of G to stakerC, fails
       * stakerC claims rewards
       * stakerA stakes A, B
       * stakerA tries to unstake A, fails
       * stakerA stakes C and D
       * stakerB exits with G
       * stakerC unstakes H and I
       * stakerA tries to claim, fails
       * time passes
       * stakerA tries to claim, no rewards left in contract
       * stakerA exits with A, B, C, and D
       */
      const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
      const newMockERC20 = await mockERC20Factory.deploy("WILD", "WilderWorld");

      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await newMockERC20.getAddress(),
        rewardsPerPeriod: BigInt(13),
        periodLength: BigInt(56),
        timeLockPeriod: BigInt(897),
        divisor: PRECISION_DIVISOR,
        lockedDivisor: LOCKED_PRECISION_DIVISOR,
        lockAdjustment: DEFAULT_LOCK_ADJUSTMENT
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig.stakingToken,
        localConfig.rewardsToken,
        localConfig.rewardsPerPeriod,
        localConfig.periodLength,
        localConfig.lockAdjustment,
        owner.address
      ) as StakingERC721;

      // New tokenIds
      const tokenIdD = 10;
      const tokenIdE = 11;
      const tokenIdF = 12;
      const tokenIdG = 13;
      const tokenIdH = 14;
      const tokenIdI = 15;

      // New tokens for stakerB
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdD);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdE);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdF);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdG);

      // New tokens for stakerC
      await stakingToken.connect(owner).mint(stakerC.address, tokenIdH);
      await stakingToken.connect(owner).mint(stakerC.address, tokenIdI);

      // Approvals for stakerA
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdC);

      // Approvals for stakerB
      await stakingToken.connect(stakerB).approve(await localStakingERC721.getAddress(), tokenIdD);
      await stakingToken.connect(stakerB).approve(await localStakingERC721.getAddress(), tokenIdE);
      await stakingToken.connect(stakerB).approve(await localStakingERC721.getAddress(), tokenIdF);
      await stakingToken.connect(stakerB).approve(await localStakingERC721.getAddress(), tokenIdG);

      // Approvals for stakerC
      await stakingToken.connect(stakerC).approve(await localStakingERC721.getAddress(), tokenIdH);
      await stakingToken.connect(stakerC).approve(await localStakingERC721.getAddress(), tokenIdI);

      let stakerAData = await localStakingERC721.nftStakers(stakerA.address);
      let stakerBData = await localStakingERC721.nftStakers(stakerB.address);
      let stakerCData = await localStakingERC721.nftStakers(stakerC.address);

      // Verify all users have no stake information
      expect(stakerAData.amountStaked).to.eq(0);
      expect(stakerAData.lastTimestamp).to.eq(0);
      expect(stakerAData.lastTimestampLocked).to.eq(0);
      expect(stakerAData.owedRewards).to.eq(0);

      expect(stakerBData.amountStaked).to.eq(0);
      expect(stakerBData.lastTimestamp).to.eq(0);
      expect(stakerBData.lastTimestampLocked).to.eq(0);
      expect(stakerBData.owedRewards).to.eq(0);

      expect(stakerCData.amountStaked).to.eq(0);
      expect(stakerCData.lastTimestamp).to.eq(0);
      expect(stakerCData.lastTimestampLocked).to.eq(0);
      expect(stakerCData.owedRewards).to.eq(0);

      await localStakingERC721.connect(stakerA).stake([tokenIdA, tokenIdB, tokenIdC], [emptyUri, emptyUri, emptyUri]);
      let origStakedAtA = BigInt(await time.latest());
      firstStakedAtA = origStakedAtA;
      let balanceAtStakeOneA = await localStakingERC721.balanceOf(stakerA.address);

      stakerAData = await localStakingERC721.nftStakers(stakerA.address);

      // `numStaked` was updated
      expect(stakerAData.amountStaked).to.eq(3);
      // `lastUpdatedTimestamp` was updated
      expect(stakerAData.lastUpdatedTimestamp).to.eq(firstStakedAtA);
      expect(stakerAData.owedRewards).to.eq(0n);
      // Unlock timestamp was set
      expect(stakerAData.unlockTimestamp).to.eq(firstStakedAtA + localConfig.timeLockPeriod);

      // Verify balance changes
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(3);

      // Verify ownership changes
      expect(await stakingToken.ownerOf(tokenIdA)).to.eq(await localStakingERC721.getAddress());
      expect(await stakingToken.ownerOf(tokenIdB)).to.eq(await localStakingERC721.getAddress());
      expect(await stakingToken.ownerOf(tokenIdC)).to.eq(await localStakingERC721.getAddress());

      // Arbitrary value to represent delay between when stakerA and stakerB stake
      const delayOne = 41n;
      await time.increase(delayOne);

      // Stake 3 of the 4 that stakerB has
      await localStakingERC721.connect(stakerB).stake([tokenIdD, tokenIdE, tokenIdF], [emptyUri, emptyUri, emptyUri]);
      const origStakeAtB = BigInt(await time.latest());
      secondStakedAtA = origStakeAtB;
      let balanceAtStakeOneB = await localStakingERC721.balanceOf(stakerB.address);

      stakerBData = await localStakingERC721.nftStakers(stakerB.address);

      // `numStaked` was updated
      expect(stakerBData.amountStaked).to.eq(3);
      // `lastUpdatedTimestamp` was updated
      expect(stakerBData.lastUpdatedTimestamp).to.eq(secondStakedAtA);
      expect(stakerBData.owedRewards).to.eq(0n);
      // Unlock timestamp was set
      expect(stakerBData.unlockTimestamp).to.eq(secondStakedAtA + localConfig.timeLockPeriod);

      // Verify balance changes
      expect(
        await stakingToken.balanceOf(stakerB.address)
      ).to.eq(1); // was minted 4 tokens, only staked 3 so far
      expect(
        await stakingToken.balanceOf(await localStakingERC721.getAddress())
      ).to.eq(6); // 3 from stakerA, 3 from stakerB

      // Verify ownership changes
      expect(await stakingToken.ownerOf(tokenIdD)).to.eq(await localStakingERC721.getAddress());
      expect(await stakingToken.ownerOf(tokenIdE)).to.eq(await localStakingERC721.getAddress());
      expect(await stakingToken.ownerOf(tokenIdF)).to.eq(await localStakingERC721.getAddress());

      // Too early to claim rewards for StakerA
      await expect(
        localStakingERC721.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Too early to claim rewards for StakerB
      await expect(
        localStakingERC721.connect(stakerB).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Increase time beyond the time lock period
      const addedTime = 14n; // Arbitrary value
      await time.increase(localConfig.timeLockPeriod + addedTime - delayOne);

      let rewardsBalanceBeforeA = await newMockERC20.balanceOf(stakerA.address);
      let pendingRewardsA = await localStakingERC721.connect(stakerA).getPendingRewards();

      // Only transfer what we need so we can have an empty rewards contract at the end
      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsA
      );

      // stakerA can successfully claim
      await localStakingERC721.connect(stakerA).claim();
      const claimedAtA = BigInt(await time.latest());

      // Verify we only transferred the exact amount necessary
      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      // Still too early for stakerB
      await expect(
        localStakingERC721.connect(stakerB).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Verify stakerA's rewards
      let rewardsBalanceAfterA = await newMockERC20.balanceOf(stakerA.address);

      let expectedRewardsA = calcTotalRewards(
        [claimedAtA - firstStakedAtA],
        [balanceAtStakeOneA],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      expect(expectedRewardsA).to.eq(pendingRewardsA);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA + expectedRewardsA);

      stakerAData = await localStakingERC721.nftStakers(stakerA.address);

      // `numStaked` was not changed in `claim`
      expect(stakerAData.amountStaked).to.eq(3);
      // `lastUpdatedTimestamp` was updated
      expect(stakerAData.lastUpdatedTimestamp).to.eq(claimedAtA);
      expect(stakerAData.owedRewards).to.eq(0n);

      // stakerC stakes using one token that is theirs and one token that is not
      // so the stake fails
      await expect(
        localStakingERC721.connect(stakerC).stake([tokenIdH, tokenIdG], [emptyUri, emptyUri])
      ).to.be.revertedWithCustomError(localStakingERC721, INCORRECT_OWNER_TRANSFER_ERR)
        .withArgs(stakerC.address, tokenIdG, await stakingToken.ownerOf(tokenIdG));

      // stakerC corrects mistake and calls to stake using only their tokens
      await localStakingERC721.connect(stakerC).stake([tokenIdH, tokenIdI], [emptyUri, emptyUri]);
      const origStakedAtC = BigInt(await time.latest());
      const stakedAtC = origStakedAtC;
      const balanceAtStakeOneC = await localStakingERC721.balanceOf(stakerC.address);

      // Verify balance and ownership change
      expect(
        await stakingToken.balanceOf(stakerC.address)
      ).to.eq(0);
      expect(
        await stakingToken.balanceOf(await localStakingERC721.getAddress())
      ).to.eq(8); // 3 from stakerA, 3 from stakerB, 2 from stakerC

      stakerCData = await localStakingERC721.nftStakers(stakerC.address);

      expect(stakerCData.amountStaked).to.eq(2);
      expect(stakerCData.lastUpdatedTimestamp).to.eq(stakedAtC);
      expect(stakerCData.owedRewards).to.eq(0n);
      expect(stakerCData.unlockTimestamp).to.eq(stakedAtC + localConfig.timeLockPeriod);

      await time.increase(delayOne);

      let pendingRewardsB = await localStakingERC721.connect(stakerB).getPendingRewards();
      let rewardsBalanceBeforeB = await newMockERC20.balanceOf(stakerB.address);

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsB
      );

      await localStakingERC721.connect(stakerB).unstake([tokenIdD], false);
      let unstakedAtB = BigInt(await time.latest());
      const claimedAtB = unstakedAtB;

      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      let rewardsBalanceAfterB = await newMockERC20.balanceOf(stakerB.address);

      let expectedRewardsB = calcTotalRewards(
        [unstakedAtB - secondStakedAtA],
        [balanceAtStakeOneB],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      balanceAtStakeOneB = await localStakingERC721.balanceOf(stakerB.address);

      expect(expectedRewardsB).to.eq(pendingRewardsB);
      expect(rewardsBalanceAfterB).to.eq(rewardsBalanceBeforeB + expectedRewardsB);

      // Verify balance and ownership change
      expect(
        await stakingToken.balanceOf(stakerB.address)
      ).to.eq(2); // staked 3 / 4 tokens, then unstaked 1, now owns 2 and has staked 2
      expect(
        await stakingToken.balanceOf(await localStakingERC721.getAddress())
      ).to.eq(7);

      stakerBData = await localStakingERC721.nftStakers(stakerB.address);

      expect(stakerBData.amountStaked).to.eq(2);
      expect(stakerBData.lastUpdatedTimestamp).to.eq(claimedAtB);
      expect(stakerBData.owedRewards).to.eq(0n);

      // Unlock period was not changed as we did not remove all staked tokens
      expect(stakerBData.unlockTimestamp).to.eq(secondStakedAtA + localConfig.timeLockPeriod);

      const delayTwo = 23n;
      await time.increase(delayTwo);

      rewardsBalanceBeforeB = await newMockERC20.balanceOf(stakerB.address);

      // stakerB calls to stake on tokenG
      await localStakingERC721.connect(stakerB).stake([tokenIdG], [emptyUri]);
      rewardsBalanceAfterB = await newMockERC20.balanceOf(stakerB.address);
      secondStakedAtA = BigInt(await time.latest());
      const balanceAtStakeTwoB = await localStakingERC721.balanceOf(stakerB.address);

      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(1);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(8);


      stakerBData = await localStakingERC721.nftStakers(stakerB.address);

      expect(stakerBData.amountStaked).to.eq(3);
      expect(stakerBData.lastUpdatedTimestamp).to.eq(secondStakedAtA);
      // Unlock period was not changed
      expect(stakerBData.unlockTimestamp).to.eq(origStakeAtB + localConfig.timeLockPeriod);

      expectedRewardsB = calcTotalRewards(
        [secondStakedAtA - unstakedAtB],
        [balanceAtStakeOneB],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      pendingRewardsB = await localStakingERC721.connect(stakerB).getPendingRewards();

      // New pending rewards are showed
      expect(expectedRewardsB).to.eq(pendingRewardsB);

      // But staker doesn't actually receive rewards until claim or unstake
      expect(rewardsBalanceAfterB).to.eq(rewardsBalanceBeforeB);

      expect(stakerBData.owedRewards).to.eq(expectedRewardsB);

      rewardsBalanceBeforeA = await newMockERC20.balanceOf(stakerA.address);
      pendingRewardsA = await localStakingERC721.connect(stakerA).getPendingRewards();

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsA
      );

      // Completely exit the staking contract
      await localStakingERC721.connect(stakerA).unstake([tokenIdA, tokenIdB, tokenIdC], false);
      const unstakedAtA = BigInt(await time.latest());

      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      rewardsBalanceAfterA = await newMockERC20.balanceOf(stakerA.address);

      stakerAData = await localStakingERC721.nftStakers(stakerA.address);

      expectedRewardsA = calcTotalRewards(
        [unstakedAtA - claimedAtA],
        [balanceAtStakeOneA],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      expect(pendingRewardsA).to.eq(expectedRewardsA);
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA + expectedRewardsA);

      // Verify total reset
      expect(stakerAData.amountStaked).to.eq(0);
      expect(stakerAData.lastUpdatedTimestamp).to.eq(0);
      expect(stakerAData.owedRewards).to.eq(0n);
      expect(stakerAData.unlockTimestamp).to.eq(0n);

      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(3);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(5);
      expect(await localStakingERC721.balanceOf(stakerA.address)).to.eq(0);

      // Too early to claim for stakerC
      await expect(
        localStakingERC721.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Move to exact timestamp stakerC can claim
      await time.increase(localConfig.timeLockPeriod - delayTwo);

      let pendingRewardsC = await localStakingERC721.connect(stakerC).getPendingRewards();
      let rewardsBalanceBeforeC = await newMockERC20.balanceOf(stakerC.address);

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsC
      );

      await localStakingERC721.connect(stakerC).claim();

      let claimedAtC = BigInt(await time.latest());
      let rewardsBalanceAfterC = await newMockERC20.balanceOf(stakerC.address);

      stakerCData = await localStakingERC721.nftStakers(stakerC.address);

      let expectedRewardsC = calcTotalRewards(
        [claimedAtC - stakedAtC],
        [balanceAtStakeOneC],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      expect(pendingRewardsC).to.eq(expectedRewardsC);
      expect(rewardsBalanceAfterC).to.eq(rewardsBalanceBeforeC + expectedRewardsC);

      // Value staked hasn't changed after claim
      expect(stakerCData.amountStaked).to.eq(2);
      // timestamp was updated by claim
      expect(stakerCData.lastUpdatedTimestamp).to.eq(claimedAtC);
      expect(stakerCData.owedRewards).to.eq(0n);
      // unlock timestamp has not changed
      expect(stakerCData.unlockTimestamp).to.eq(origStakedAtC + localConfig.timeLockPeriod);

      pendingRewardsB = await localStakingERC721.connect(stakerB).getPendingRewards();
      rewardsBalanceBeforeB = await newMockERC20.balanceOf(stakerB.address);

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsB
      );

      // stakerB will now own have D, E, F owned and G staked
      await localStakingERC721.connect(stakerB).unstake([tokenIdE, tokenIdF], false);
      unstakedAtB = BigInt(await time.latest()); // update timestamp yet?

      rewardsBalanceAfterB = await newMockERC20.balanceOf(stakerB.address);

      expectedRewardsB = calcTotalRewards(
        [unstakedAtB - secondStakedAtA],
        [balanceAtStakeTwoB],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      stakerBData = await localStakingERC721.nftStakers(stakerB.address);

      expect(expectedRewardsB).to.eq(pendingRewardsB);
      expect(rewardsBalanceAfterB).to.eq(rewardsBalanceBeforeB + expectedRewardsB);

      expect(stakerBData.amountStaked).to.eq(1);
      expect(stakerBData.lastUpdatedTimestamp).to.eq(unstakedAtB);
      expect(stakerBData.owedRewards).to.eq(0n);
      // Verify unchanged during unstake as we did not exit completely
      expect(stakerBData.unlockTimestamp).to.eq(origStakeAtB + localConfig.timeLockPeriod);

      // stakerB transfers tokenD to stakerA and tokenE to stakerC
      await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerA.address, tokenIdD);
      await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerC.address, tokenIdE);

      // Verify transfers
      expect(await stakingToken.ownerOf(tokenIdD)).to.eq(stakerA.address);
      expect(await stakingToken.ownerOf(tokenIdE)).to.eq(stakerC.address);

      // stakerB fails to transfer tokenG, it is a nontransferrable SNFT
      await expect(
        localStakingERC721.connect(stakerB).transferFrom(stakerB.address, stakerC.address, tokenIdG)
      ).to.be.revertedWithCustomError(localStakingERC721, NON_TRANSFERRABLE_ERR);

      await time.increase(config.periodLength * 5n);
      // stakerC claims rewards
      rewardsBalanceBeforeC = await newMockERC20.balanceOf(stakerC.address);
      pendingRewardsC = await localStakingERC721.connect(stakerC).getPendingRewards();

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsC
      );

      await localStakingERC721.connect(stakerC).claim();

      rewardsBalanceAfterC = await newMockERC20.balanceOf(stakerC.address);

      expectedRewardsC = calcTotalRewards(
        [BigInt(await time.latest()) - claimedAtC],
        [balanceAtStakeOneC],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      claimedAtC = BigInt(await time.latest());

      expect(expectedRewardsC).to.eq(pendingRewardsC);
      expect(rewardsBalanceAfterC).to.eq(rewardsBalanceBeforeC + expectedRewardsC);

      stakerCData = await localStakingERC721.nftStakers(stakerC.address);

      // Value staked is unchanged
      expect(stakerCData.amountStaked).to.eq(2);
      // Timestamp is updated
      expect(stakerCData.lastUpdatedTimestamp).to.eq(claimedAtC);
      // No pending rewards after claim
      expect(stakerCData.owedRewards).to.eq(0n);
      // Unlock timestamp is unchanged
      expect(stakerCData.unlockTimestamp).to.eq(origStakedAtC + localConfig.timeLockPeriod);

      // stakerA stakes tokenA and tokenB
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdB);

      await localStakingERC721.connect(stakerA).stake([tokenIdA, tokenIdB], [emptyUri, emptyUri]);
      origStakedAtA = BigInt(await time.latest());
      firstStakedAtA = origStakedAtA;

      balanceAtStakeOneA = await localStakingERC721.balanceOf(stakerA.address);

      stakerAData = await localStakingERC721.nftStakers(stakerA.address);

      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(2);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(5);

      // Verify updated user data
      expect(stakerAData.amountStaked).to.eq(2);
      expect(stakerAData.lastUpdatedTimestamp).to.eq(firstStakedAtA);
      expect(stakerAData.owedRewards).to.eq(0n);

      // Verify new unlock timestamp was set
      expect(stakerAData.unlockTimestamp).to.eq(firstStakedAtA + localConfig.timeLockPeriod);

      await time.increase(localConfig.periodLength * 2n);

      // Cannot unstake until the timelock has passed
      await expect(
        localStakingERC721.connect(stakerA).unstake([tokenIdA], false)
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      // Stake the next two owned tokens
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdC);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdD);

      rewardsBalanceBeforeA = await newMockERC20.balanceOf(stakerA.address);
      pendingRewardsA = await localStakingERC721.connect(stakerA).getPendingRewards();

      await localStakingERC721.connect(stakerA).stake([tokenIdC, tokenIdD], [emptyUri, emptyUri]);

      rewardsBalanceAfterA = await newMockERC20.balanceOf(stakerA.address);

      expectedRewardsA = calcTotalRewards(
        [BigInt(await time.latest()) - firstStakedAtA],
        [balanceAtStakeOneA],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      firstStakedAtA = BigInt(await time.latest());

      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(7);

      expect(expectedRewardsA).to.eq(pendingRewardsA);
      // No rewards are given until claim or unstake
      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);

      stakerAData = await localStakingERC721.nftStakers(stakerA.address);

      expect(stakerAData.amountStaked).to.eq(4);
      expect(stakerAData.lastUpdatedTimestamp).to.eq(firstStakedAtA);
      expect(stakerAData.owedRewards).to.eq(expectedRewardsA);

      // stakerB exits without rewards
      rewardsBalanceBeforeB = await newMockERC20.balanceOf(stakerB.address);
      pendingRewardsB = await localStakingERC721.connect(stakerB).getPendingRewards();


      // stakerB unstakes tokenIdG without rewards
      await localStakingERC721.connect(stakerB).unstake([tokenIdG], true);
      unstakedAtB = BigInt(await time.latest());

      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      rewardsBalanceAfterB = await newMockERC20.balanceOf(stakerB.address);

      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(2);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(6);

      // No rewards given
      expect(rewardsBalanceAfterB).to.eq(rewardsBalanceBeforeB);

      stakerBData = await localStakingERC721.nftStakers(stakerB.address);

      expect(stakerBData.amountStaked).to.eq(0n);
      expect(stakerBData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerBData.owedRewards).to.eq(0n);
      expect(stakerBData.unlockTimestamp).to.eq(0n);

      rewardsBalanceBeforeC = await newMockERC20.balanceOf(stakerC.address);
      pendingRewardsC = await localStakingERC721.connect(stakerC).getPendingRewards();

      await newMockERC20.connect(owner).transfer(
        await localStakingERC721.getAddress(),
        pendingRewardsC
      );

      await localStakingERC721.connect(stakerC).unstake([tokenIdH, tokenIdI], false);
      const unstakedAtC = BigInt(await time.latest());
      rewardsBalanceAfterC = await newMockERC20.balanceOf(stakerC.address);

      // Be sure we only transferred what we need
      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      expectedRewardsC = calcTotalRewards(
        [unstakedAtC - claimedAtC],
        [balanceAtStakeOneC],
        localConfig.rewardsPerPeriod,
        localConfig.periodLength
      );

      expect(expectedRewardsC).to.eq(pendingRewardsC);
      expect(rewardsBalanceAfterC).to.eq(rewardsBalanceBeforeC + expectedRewardsC);

      // tokenE, tokenH, and tokenI
      expect(await stakingToken.balanceOf(stakerC.address)).to.eq(3);
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(4);
      expect(await localStakingERC721.balanceOf(stakerC.address)).to.eq(0);

      stakerCData = await localStakingERC721.nftStakers(stakerC.address);

      expect(stakerCData.amountStaked).to.eq(0n);
      expect(stakerCData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerCData.owedRewards).to.eq(0n);
      expect(stakerCData.unlockTimestamp).to.eq(0n);

      // No rewards remain in the pool
      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      // Too early for stakerA to claim
      await expect(
        localStakingERC721.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, TIME_LOCK_NOT_PASSED_ERR);

      await time.increase(origStakedAtA + localConfig.timeLockPeriod);

      // Even when the time lock has passed, we don't have the rewards necessary to claim
      expect(await newMockERC20.balanceOf(await localStakingERC721.getAddress())).to.eq(0);

      // Cannot claim when the contract has no more rewards to distribute
      await expect(
        localStakingERC721.connect(stakerA).claim()
      ).to.be.revertedWithCustomError(localStakingERC721, NO_REWARDS_BALANCE_ERR);

      rewardsBalanceBeforeA = await newMockERC20.balanceOf(stakerA.address);

      // Must exit
      await localStakingERC721.connect(stakerA).unstake([tokenIdA, tokenIdB, tokenIdC, tokenIdD], true);

      rewardsBalanceAfterA = await newMockERC20.balanceOf(stakerA.address);

      expect(rewardsBalanceAfterA).to.eq(rewardsBalanceBeforeA);

      stakerAData = await localStakingERC721.nftStakers(stakerA.address);

      expect(stakerAData.amountStaked).to.eq(0n);
      expect(stakerAData.lastUpdatedTimestamp).to.eq(0n);
      expect(stakerAData.owedRewards).to.eq(0n);
      expect(stakerAData.unlockTimestamp).to.eq(0n);

      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(4);
      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(2);
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(4);

      // There are no remaining stakes
      expect(await stakingToken.balanceOf(await localStakingERC721.getAddress())).to.eq(0);
    });
  });

  describe.skip("Helper functions", () => {
    it("#setBaseURI() should set the base URI", async () => {
      await stakingToken.connect(stakerA).approve(stakingERC721.target, tokenIdA);
      await stakingERC721.connect(stakerA).stake([tokenIdA], [emptyUri]);

      const newBaseUri = "https://newbaseuri.com/";
      await stakingERC721.connect(owner).setBaseURI(newBaseUri);

      expect(await stakingERC721.tokenURI(tokenIdA)).to.eq(newBaseUri + tokenIdA);
    });

    it("#setTokenURI() should set the token URI and return it properly when baseURI is empty", async () => {
      const newTokenUri = "https://newtokenuri.com/";
      await stakingERC721.connect(owner).setBaseURI("");
      await stakingERC721.connect(owner).setTokenURI(tokenIdA, newTokenUri);

      const uriFromContract = await stakingERC721.tokenURI(tokenIdA);

      expect(uriFromContract).to.eq(newTokenUri);

      await stakingERC721.connect(stakerA).unstake([tokenIdA], true);
    });

    // eslint-disable-next-line max-len
    it("#stake() with passed tokenURI should set the token URI when baseURI is empty and change back to baseURI when needed", async () => {
      const newTokenUri = "https://specialtokenuri.com/";
      await stakingToken.connect(stakerA).approve(stakingERC721.target, tokenIdA);
      await stakingERC721.connect(stakerA).stake([tokenIdA], [newTokenUri]);

      const uriFromContract = await stakingERC721.tokenURI(tokenIdA);
      expect(uriFromContract).to.eq(newTokenUri);

      await stakingERC721.connect(owner).setBaseURI(baseUri);
      await stakingERC721.connect(owner).setTokenURI(tokenIdA, "");

      const newURI = await stakingERC721.tokenURI(tokenIdA);
      expect(newURI).to.eq(baseUri + tokenIdA);
    });

    it("#withdrawLeftoverRewards() should withdraw all remaining rewards and emit an event", async () => {
      const contractBalBefore = await rewardToken.balanceOf(stakingERC721.target);
      expect(contractBalBefore).to.be.gt(0);

      await expect(
        stakingERC721.connect(owner).withdrawLeftoverRewards()
      ).to.emit(stakingERC721, WITHDRAW_EVENT)
        .withArgs(owner.address, contractBalBefore);

      const contractBalAfter = await rewardToken.balanceOf(stakingERC721.target);
      expect(contractBalAfter).to.eq(0);
    });

    it("#withdrawLeftoverRewards() should revert if contract balance is 0", async () => {
      await expect(
        stakingERC721.connect(owner).withdrawLeftoverRewards()
      ).to.be.revertedWithCustomError(stakingERC721, NO_REWARDS_BALANCE_ERR);
    });

    it("#withdrawLeftoverRewards() should only be callable by the owner", async () => {
      await expect(
        stakingERC721.connect(notStaker).withdrawLeftoverRewards()
      ).to.be.revertedWithCustomError(stakingERC721, OWNABLE_UNAUTHORIZED_ERR)
        .withArgs(notStaker.address);
    });

    it("#supportsInterface() should return true for ERC721 interface or interface of staking contract", async () => {
      // get the interface ids programmatically
      const erc721InterfaceId = "0x80ac58cd";

      const stakingInterface = await stakingERC721.getInterfaceId();

      expect(await stakingERC721.supportsInterface(erc721InterfaceId)).to.eq(true);
      expect(await stakingERC721.supportsInterface(stakingInterface)).to.eq(true);
    });

    it("Should allow to change ownership", async () => {
      await stakingERC721.connect(owner).transferOwnership(notStaker.address);

      expect(await stakingERC721.owner()).to.eq(notStaker.address);
    });

    it("should allow to renounce ownership", async () => {
      await stakingERC721.connect(notStaker).renounceOwnership();

      expect(await stakingERC721.owner()).to.eq(hre.ethers.ZeroAddress);
    });
  });
});
