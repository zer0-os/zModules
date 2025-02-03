import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  MockERC20,
  MockERC721,
  StakingERC721, ZeroVotingERC721,
} from "../typechain";
import {
  createDefaultStakingConfig,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  BaseConfig,
  WITHDRAW_EVENT,
  DEFAULT_LOCK,
  calcTotalUnlockedRewards,
  calcStakeRewards,
  DEFAULT_MINIMUM_LOCK,
  DEFAULT_MINIMUM_RM,
  DEFAULT_MAXIMUM_RM,
  getNativeSetupERC721,
  DAY_IN_SECONDS,
} from "./helpers/staking";
import {
  FAILED_INNER_CALL_ERR,
  FUNCTION_SELECTOR_ERR,
  ZERO_INIT_ERR,
  INCORRECT_OWNER_ERR,
  NONEXISTENT_TOKEN_ERR,
  INSUFFICIENT_APPROVAL_721_ERR, OWNABLE_UNAUTHORIZED_ERR,
  ZERO_REWARDS_ERR,
  INVALID_UNSTAKE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  INSUFFICIENT_CONTRACT_BALANCE_ERR,
  NOT_FULL_EXIT_ERR,
  CANNOT_EXIT_ERR,
} from "./helpers/errors";


describe("StakingERC721", () => {
  let owner : SignerWithAddress;
  let stakerA : SignerWithAddress;
  let stakerB : SignerWithAddress;
  let stakerC : SignerWithAddress;
  let notStaker : SignerWithAddress;

  let stakingERC721 : StakingERC721;
  let rewardToken : MockERC20;
  let stakingToken : MockERC721;
  let stakeRepToken : ZeroVotingERC721;

  // We don't use `PoolConfig` anymore on the contracts but for convenience in testing
  // we can leave this type where it is
  let config : BaseConfig;

  // Keep timestamps for users
  let firstStakedAtA : bigint;
  let secondStakedAtA : bigint;

  let firstStakedAtB : bigint;
  let secondStakedAtB : bigint;

  // Default token ids
  const tokenIdA = 1n;
  const tokenIdB = 2n;
  const tokenIdC = 3n;
  const tokenIdD = 4n;
  const tokenIdE = 5n;
  const tokenIdF = 6n;
  const tokenIdG = 7n;
  const tokenIdH = 8n;
  const tokenIdI = 9n;
  const tokenIdJ = 10n;

  const tokenIdDelayed = 11n; // Minted and used in stake at a later point in time
  const unstakedTokenId = 12n; // Minted but never used in stake
  const unmintedTokenId = 13n; // Never minted

  const baseUri = "0://staked-nfts";
  const emptyUri = "";

  let reset : () => Promise<void>;

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

      const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");
      stakingToken = await mockERC721Factory.deploy("WilderWheels", "WW", baseUri);

      const stakeRepFactory = await hre.ethers.getContractFactory("ZeroVotingERC721");
      stakeRepToken = await stakeRepFactory.deploy("VotingToken", "VNFT", baseUri, "ZERO DAO", "1.0", owner.address);

      config = await createDefaultStakingConfig(
        owner,
        rewardToken,
        stakingToken,
        undefined,
        undefined,
        stakeRepToken,
      );

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      stakingERC721 = await stakingFactory.deploy(config);

      const stakingERC721Address = await stakingERC721.getAddress();

      await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), stakingERC721Address);
      await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), stakingERC721Address);

      // Give staking contract balance to pay rewards
      await rewardToken.connect(owner).mint(
        stakingERC721Address,
        hre.ethers.parseEther("999999999")
      );

      await stakingToken.mint(stakerA.address, tokenIdA);
      await stakingToken.mint(stakerA.address, tokenIdB);
      await stakingToken.mint(stakerA.address, tokenIdC);

      await stakingToken.mint(stakerB.address, tokenIdD);
      await stakingToken.mint(stakerB.address, tokenIdE);
      await stakingToken.mint(stakerB.address, tokenIdF);
      await stakingToken.mint(stakerB.address, tokenIdG);

      await stakingToken.mint(stakerC.address, tokenIdH);
      await stakingToken.mint(stakerC.address, tokenIdI);
      await stakingToken.mint(stakerC.address, tokenIdJ);

      await stakingToken.mint(owner.address, unstakedTokenId);

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdD);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdE);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdF);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdG);

      await stakingToken.connect(stakerC).approve(await stakingERC721.getAddress(), tokenIdH);
      await stakingToken.connect(stakerC).approve(await stakingERC721.getAddress(), tokenIdI);
      await stakingToken.connect(stakerC).approve(await stakingERC721.getAddress(), tokenIdJ);
    };

    // Call to setup the first time
    await reset();
  });

  it("Should NOT deploy with zero values passed", async () => {
    const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");

    let localConfig = config;
    localConfig.stakingToken = hre.ethers.ZeroAddress;

    await expect(
      stakingFactory.deploy(
        config
      )
    ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);

    localConfig = config;
    localConfig.rewardsToken = hre.ethers.ZeroAddress;

    await expect(
      stakingFactory.deploy(
        config
      )
    ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);

    localConfig = config;
    localConfig.rewardsPerPeriod = 0n;

    await expect(
      stakingFactory.deploy(
        config
      )
    ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);

    localConfig = config;
    localConfig.periodLength = 0n;

    await expect(
      stakingFactory.deploy(
        config
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

  describe("#stake", () => {
    let amountStaked : bigint;
    let amountStakedLocked : bigint;
    it("Can stake a single NFT using #stakeWithoutLock and mint `stakeRepToken`", async () => {
      await reset();

      // stakerA starts with tokenA, tokenB, and tokenC
      const supplyBefore = await stakeRepToken.totalSupply();

      amountStaked = 1n;
      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      firstStakedAtA = BigInt(await time.latest());

      const supplyAfter = await stakeRepToken.totalSupply();

      const stakerData = await stakingERC721.connect(stakerA).nftStakers(stakerA.address);

      const tokenUri = await stakeRepToken.tokenURI(tokenIdA);
      expect(tokenUri).to.eq(baseUri + tokenIdA);

      // A new sNFT was created
      expect(supplyAfter).to.eq(supplyBefore + 1n);

      // User still has tokenIdB and tokenIdC
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(2);

      // User now has one sNFT after staking
      expect(await stakeRepToken.balanceOf(stakerA.address)).to.eq(1);

      expect(stakerData.amountStaked).to.eq(amountStaked);
      expect(stakerData.lastTimestamp).to.eq(firstStakedAtA);
    });

    it("Can stake a single NFT using #stakeWithLock", async () => {
      // stakerB starts with tokenD, tokenE, tokenF, and tokenG
      const supplyBefore = await stakeRepToken.totalSupply();

      amountStakedLocked = 1n;
      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdD], [emptyUri], DEFAULT_LOCK);
      firstStakedAtB = BigInt(await time.latest());

      const supplyAfter = await stakeRepToken.totalSupply();

      const stakerData = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);

      const tokenUri = await stakeRepToken.tokenURI(tokenIdD);
      expect(tokenUri).to.eq(baseUri + tokenIdD);

      // User has staked their NFT and gained an sNFT
      expect(supplyAfter).to.eq(supplyBefore + 1n);

      // User still has tokenE, tokenF, and tokenG
      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(3);

      // User has been given the sNFT for tokenD
      expect(await stakeRepToken.balanceOf(stakerB.address)).to.eq(1);

      expect(stakerData.amountStaked).to.eq(0n); // No unlocked stakes
      expect(stakerData.amountStakedLocked).to.eq(amountStakedLocked);
      expect(stakerData.lastTimestampLocked).to.eq(firstStakedAtB);
    });

    it("Can stake multiple NFTs using #stakeWithoutLock", async () => {
      // stakerA has tokenIdB and tokenIdC remaining, and stakes both
      const supplyBefore = await stakeRepToken.totalSupply();

      amountStaked += 2n;
      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdB, tokenIdC], [emptyUri, emptyUri]);
      secondStakedAtA = BigInt(await time.latest());

      const supplyAfter = await stakeRepToken.totalSupply();

      const stakerData = await stakingERC721.connect(stakerA).nftStakers(stakerA.address);

      expect(supplyAfter).to.eq(supplyBefore + 2n);

      // User has staked their remaining NFTs and gained two sNFTs
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakeRepToken.balanceOf(stakerA.address)).to.eq(3);

      expect(stakerData.amountStaked).to.eq(amountStaked);
      expect(stakerData.lastTimestamp).to.eq(secondStakedAtA);
    });

    it("Can stake multiple NFTs using #stakeWithLock", async () => {
      // stakerB has tokenIdE, tokenIdF, and tokenIdG remaining, stakes E and F
      const supplyBefore = await stakeRepToken.totalSupply();

      amountStakedLocked += 2n;
      await stakingERC721.connect(stakerB).stakeWithLock(
        [tokenIdE, tokenIdF],
        [emptyUri, emptyUri],
        DEFAULT_LOCK
      );

      secondStakedAtB = BigInt(await time.latest());

      const supplyAfter = await stakeRepToken.totalSupply();

      const stakerData = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);

      expect(supplyAfter).to.eq(supplyBefore + 2n);

      // User still has tokenIdG
      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(1);

      // User has staked tokenIdE and tokenIdF and gained two sNFTs, totalling 3
      expect(await stakeRepToken.balanceOf(stakerB.address)).to.eq(3);

      expect(stakerData.amountStakedLocked).to.eq(amountStakedLocked);

      expect(stakerData.lastTimestampLocked).to.eq(secondStakedAtB);
    });

    it("Fails to stake when the token is already staked", async () => {
      // If the token is staked, the owner will be the staking contract not the original owner
      await expect(
        stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri])
      ).to.be.revertedWithCustomError(stakingToken, INCORRECT_OWNER_ERR)
        .withArgs(stakerA.address, tokenIdA, await stakingERC721.getAddress());

      await expect(
        stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK)
      ).to.be.revertedWithCustomError(stakingToken, INCORRECT_OWNER_ERR)
        .withArgs(stakerA.address, tokenIdA, await stakingERC721.getAddress());
    });

    it("Does not modify the lock duration upon follow up stake", async () => {
      await reset();

      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdD], [emptyUri], DEFAULT_LOCK);

      const stakedAtFirst = BigInt(await time.latest());

      const timeIncrease = 100n;
      await time.increase(timeIncrease);

      // Existing lock is `DEFAULT_LOCK - 100s` now, so the incoming lock will be larger and it should update
      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdE], [emptyUri], DEFAULT_LOCK);

      const stakerDataAfter = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);

      // We increase the staker's lockDuration by the amount they already have configured
      // as the initial lockDuration
      expect(stakerDataAfter.unlockedTimestamp).to.eq(stakedAtFirst + DEFAULT_LOCK);
    });

    it("Does not modify the lock duration when a follow up stake provides a smaller lock duration", async () => {
      await reset();

      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdD], [emptyUri], DEFAULT_LOCK);

      const stakerDataBefore = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);

      const timeIncrease = 100n;
      await time.increase(timeIncrease);

      // Existing lock is `DEFAULT_LOCK - 100s` now, so the incoming lock will be smaller and it should not update
      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdE], [emptyUri], DEFAULT_LOCK / 2n);

      const stakerDataAfter = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);

      // We increase the staker's lockDuration by the amount they already have configured
      // as the initial lockDuration
      expect(stakerDataAfter.unlockedTimestamp).to.eq(stakerDataBefore.unlockedTimestamp);
    });

    it("Fails to stake when the token id is invalid", async () => {
      // Token is not minted, and so is invalid
      await expect(
        stakingERC721.connect(stakerA).stakeWithoutLock([unmintedTokenId], [emptyUri])
      ).to.be.revertedWithCustomError(stakeRepToken, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);

      await expect(
        stakingERC721.connect(stakerA).stakeWithLock([unmintedTokenId], [emptyUri], DEFAULT_LOCK)
      ).to.be.revertedWithCustomError(stakingToken, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);
    });

    it("Fails to stake when the caller is not the owner of the NFT", async () => {
      // Staker does not own the token and cannot stake it
      await reset();

      await expect(
        stakingERC721.connect(stakerA).stakeWithoutLock([unstakedTokenId], [emptyUri])
      ).to.be.revertedWithCustomError(stakingToken, INSUFFICIENT_APPROVAL_721_ERR)
        .withArgs(stakingERC721.target, unstakedTokenId);

      await expect(
        stakingERC721.connect(stakerA).stakeWithLock([tokenIdD], [emptyUri], DEFAULT_LOCK)
      ).to.be.revertedWithCustomError(stakingToken, INCORRECT_OWNER_ERR)
        .withArgs(stakerA.address, tokenIdD, stakerB.address);
    });
  });

  describe("#getRemainingLockTime", () => {
    it("Allows the user to view the remaining time lock duration", async () => {
      await reset();

      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK / 2n);

      const remainingLockTime = await stakingERC721.connect(stakerA).getRemainingLockTime();
      const latest = BigInt(await time.latest());

      const stakerData = await stakingERC721.nftStakers(stakerA.address);
      const stakeTimestamp = stakerData.lastTimestampLocked;

      // Original lock period and remaining lock period time difference should be the same as
      // the difference between the latest timestamp and that token's stake timestamp
      expect(remainingLockTime).to.eq((latest - stakeTimestamp));
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

      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdG], [emptyUri], DEFAULT_LOCK);

      const initPendingRewards = await stakingERC721.connect(stakerB).getPendingRewards();

      // If no time has passed, the value will be 0
      expect(initPendingRewards).to.eq(0);

      await time.increase(DEFAULT_LOCK / 2n);

      const stakerData = await stakingERC721.nftStakers(stakerB.address);

      const pendingRewards = await stakingERC721.connect(stakerB).getPendingRewards();

      const stakeValue = calcStakeRewards(
        1n,
        DEFAULT_LOCK,
        true,
        config,
      );

      expect(pendingRewards).to.eq(0n); // 0 as not passed lock time yet
      expect(stakerData.owedRewardsLocked).to.eq(stakeValue);

      await time.increase(DEFAULT_LOCK / 2n);
      const pendingRewardsAfter = await stakingERC721.connect(stakerB).getPendingRewards();
      expect(pendingRewardsAfter).to.eq(stakerData.owedRewardsLocked);
    });

    it("Returns 0 for users that have not passed any time", async () => {
      const tokenId = 1000n;
      await stakingToken.connect(owner).mint(stakerB.address, tokenId);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenId);

      await stakingERC721.connect(stakerB).stakeWithLock([tokenId], [emptyUri], DEFAULT_LOCK);
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

      await stakingERC721.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const expectedRewards = calcStakeRewards(
        1n,
        claimedAt - stakedAt,
        false,
        config
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);

      await time.increase(DEFAULT_LOCK / 2n);

      const balanceBeforeSecond = await rewardToken.balanceOf(stakerA.address);

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

    it("Fails to claim when only locked stake and not enough time has passed", async () => {
      await reset();

      await stakingToken.connect(owner).mint(stakerC.address, tokenIdDelayed);
      await stakingToken.connect(stakerC).approve(await stakingERC721.getAddress(), tokenIdDelayed);

      await stakingERC721.connect(stakerC).stakeWithLock([tokenIdDelayed], [emptyUri], DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK / 2n);

      // The user cannot claim as not enough time has passed
      await expect(
        stakingERC721.connect(stakerC).claim()
      ).to.be.revertedWithCustomError(stakingERC721, ZERO_REWARDS_ERR);
    });

    it("Claims when caller has both locked and unlocked stake even if the lock duration is not complete", async () => {
      await reset();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      const stakedAtWithoutLock = BigInt(await time.latest());

      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdB], [emptyUri], DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK / 2n);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      await stakingERC721.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const expectedRewards = calcTotalUnlockedRewards(
        [claimedAt - stakedAtWithoutLock],
        [1n],
        config
      );

      expect(balanceAfter).to.eq(balanceBefore + expectedRewards);
    });

    // eslint-disable-next-line max-len
    it("Claims full rewards when both locked and not locked stakes exist and the lock duration has passed", async () => {
      await reset();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      const stakedAtWithoutLock = BigInt(await time.latest());

      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdB], [emptyUri], DEFAULT_LOCK);

      await time.increase(DEFAULT_LOCK + 5n);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      await stakingERC721.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const expectedUnlocked = calcStakeRewards(
        1n,
        claimedAt - stakedAtWithoutLock,
        false,
        config
      );

      const expectedLockedStakeValue = calcStakeRewards(
        1n,
        DEFAULT_LOCK,
        true,
        config,
      );

      const expectedLockedInterimRewards = calcStakeRewards(
        1n,
        claimedAt - stakerDataBefore.unlockedTimestamp,
        false,
        config
      );

      expect(
        balanceAfter
      ).to.eq(
        balanceBefore + expectedUnlocked + expectedLockedStakeValue + expectedLockedInterimRewards
      );
    });

    it("Fails to claim when the caller has no stakes", async () => {
      // Will fail when we check `onlyUnlocked` modifier first
      await expect(
        stakingERC721.connect(notStaker).claim()
      ).to.be.revertedWithCustomError(stakingERC721, ZERO_REWARDS_ERR);
    });
  });

  describe("#unstakeUnlocked", () => {
    let stakedAtUnlocked : bigint;
    let stakedAtLocked : bigint;
    let unstakedAt : bigint;

    it("Can unstake a token that is not locked", async () => {
      await reset();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      stakedAtUnlocked = BigInt(await time.latest());

      await stakingERC721.connect(stakerA).stakeWithLock(
        [tokenIdB, tokenIdC],
        [emptyUri, emptyUri],
        DEFAULT_LOCK
      );
      stakedAtLocked = BigInt(await time.latest());

      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      await time.increase(DEFAULT_LOCK);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      await stakingERC721.connect(stakerA).unstakeUnlocked([tokenIdA]);
      unstakedAt = BigInt(await time.latest());

      expect(stakerDataBefore.amountStaked).to.eq(1n);

      const expectedUnlocked = calcStakeRewards(
        stakerDataBefore.amountStaked,
        unstakedAt - stakedAtUnlocked,
        false,
        config
      );

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore + expectedUnlocked);

      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);

      // User has regained their NFT and the SNFT was burned
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakeRepToken.balanceOf(stakerA.address)).to.eq(2);

      // because we fully withdrew non-locked funds, we reset
      expect(stakerDataAfter.amountStaked).to.eq(0);
      expect(stakerDataAfter.lastTimestamp).to.eq(0);
      expect(stakerDataAfter.owedRewards).to.eq(0n);

      // We are still staked with locked funds, and that is withheld in the staker data
      expect(stakerDataAfter.amountStakedLocked).to.eq(2);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(stakedAtLocked);

      // Confirm the sNFT was burned
      await expect(
        stakeRepToken.ownerOf(tokenIdA)
      ).to.be.revertedWithCustomError(stakeRepToken, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdA);
    });

    it("Can unstake multiple locked tokens", async () => {
      await reset();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      stakedAtUnlocked = BigInt(await time.latest());

      await stakingERC721.connect(stakerA).stakeWithLock(
        [tokenIdB, tokenIdC],
        [emptyUri, emptyUri],
        DEFAULT_LOCK
      );
      stakedAtLocked = BigInt(await time.latest());

      // Add arbitrary amount of interim time
      const interimTime = 13n;
      await time.increase(DEFAULT_LOCK + interimTime);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      // throws invalid unstake ?
      await stakingERC721.connect(stakerA).unstakeLocked([tokenIdB, tokenIdC]);
      unstakedAt = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const lockedStakeRewards = calcStakeRewards(
        stakerDataBefore.amountStakedLocked,
        DEFAULT_LOCK,
        true,
        config,
      );

      const interimTimeRewards = calcStakeRewards(
        stakerDataBefore.amountStakedLocked,
        unstakedAt - stakerDataBefore.unlockedTimestamp,
        false,
        config
      );

      expect(balanceAfter).to.eq(balanceBefore + lockedStakeRewards + interimTimeRewards);

      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);

      // User has regained their NFTs and the SNFT was burned
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(2); // unstaked two
      expect(await stakeRepToken.balanceOf(stakerA.address)).to.eq(1); // one remains staked
      expect((await stakingERC721.nftStakers(stakerA.address)).amountStaked).to.eq(1);
      expect((await stakingERC721.nftStakers(stakerA.address)).amountStakedLocked).to.eq(0);

      // Staker data has been reset when they have completely unstaked
      // Because `unstake` also claims, the non-locked timestamp is updated as well
      expect(stakerDataAfter.lastTimestamp).to.eq(stakedAtUnlocked);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(0n);
      expect(stakerDataAfter.amountStaked).to.eq(stakerDataBefore.amountStaked);
      expect(stakerDataAfter.amountStakedLocked).to.eq(stakerDataBefore.amountStakedLocked - 2n);
      expect(stakerDataAfter.owedRewards).to.eq(0n);
      expect(stakerDataAfter.owedRewardsLocked).to.eq(0n); // Still staked, but haven't updated the rewards yet

      expect(await stakingERC721.isLocked(stakerA.address, tokenIdB)).to.eq(false);
      expect(await stakingERC721.isLocked(stakerA.address, tokenIdC)).to.eq(false);

      await expect(
        stakeRepToken.ownerOf(tokenIdB)
      ).to.be.revertedWithCustomError(stakeRepToken, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdB);
      await expect(
        stakeRepToken.ownerOf(tokenIdC)
      ).to.be.revertedWithCustomError(stakeRepToken, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdC);
    });

    it("Fails to unstake locked tokens without 'exit' when not enough time has passed", async () => {
      await reset();

      // Restake to be able to unstake again
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);

      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK);

      await expect(
        stakingERC721.connect(stakerA).unstakeUnlocked([tokenIdA])
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });

    it("Fails to unstake when token id is invalid", async () => {
      await time.increase(DEFAULT_LOCK);

      await expect(
        stakingERC721.connect(stakerA).unstakeUnlocked([unmintedTokenId])
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });

    it("Fails to unstake when caller is not the owner of the SNFT", async () => {
      // If the user has no stakes, the reversion is by default a `TimeLockNotPassed`,
      // we had stakes here to avoid this path
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdD);
      await stakingERC721.connect(stakerB).stakeWithoutLock([tokenIdD], [emptyUri]);
      // await time.increase(config.timeLockPeriod);

      await expect(
        stakingERC721.connect(stakerA).unstakeUnlocked([tokenIdD])
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });

    it("Fails to unstake when token id is not staked", async () => {
      // If the a token is not staked, the relevant does not exist and so we can't unstake it
      await expect(
        stakingERC721.connect(stakerA).unstakeUnlocked([unstakedTokenId])
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });
  });

  describe("#unstakeLocked", async () => {

    it("Allows you to unstake locked tokens passed their unlockedTimestamp", async () => {
      await reset();

      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK);

      const interimTime = 37n;
      await time.increase(DEFAULT_LOCK + interimTime);

      const rewardsBalanceBefore = await rewardToken.balanceOf(stakerA.address);

      await stakingERC721.connect(stakerA).unstakeLocked([tokenIdA]);

      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);
      const rewardsBalanceAfter = await rewardToken.balanceOf(stakerA.address);

      const expectedLockedRewards = calcStakeRewards(
        1n,
        DEFAULT_LOCK,
        true,
        config,
      );

      const expectedInterimRewards = calcStakeRewards(
        1n,
        interimTime + 1n, // + 1 for automine after call to `unstakeLocked`
        false,
        config,
      );

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + expectedLockedRewards + expectedInterimRewards);

      // Never had unlocked stake
      expect(stakerDataAfter.amountStaked).to.eq(0n);
      expect(stakerDataAfter.lastTimestamp).to.eq(0n);
      expect(stakerDataAfter.owedRewards).to.eq(0n);

      expect(stakerDataAfter.amountStakedLocked).to.eq(0n);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(0n);
      expect(stakerDataAfter.owedRewardsLocked).to.eq(0n);
    });

    it("Fails if the caller does not own the sNFT", async () => {
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK);

      await expect(
        stakingERC721.connect(stakerB).unstakeLocked([tokenIdA])
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });

    it("Fails if the sNFT does not exist", async () => {
      await time.increase(DEFAULT_LOCK);

      await stakingERC721.connect(stakerA).unstakeLocked([tokenIdA]);

      // Because we `burn` on exit, the token would no longer exist
      await expect(
        stakingERC721.connect(stakerA).unstakeLocked([tokenIdA])
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });
  });

  describe("#exit", () => {
    let amountStakedLocked : bigint;
    let stakedAtLocked : bigint;
    it("Allows the user to remove a single stake within the timelock period without rewards", async () => {
      await reset();

      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdD);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdE);

      // Stake with lock
      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdD, tokenIdE], [emptyUri, emptyUri], DEFAULT_LOCK);

      // Stake without lock
      await stakingERC721.connect(stakerB).stakeWithoutLock([tokenIdF], [emptyUri]);
      const stakedAtUnlocked = BigInt(await time.latest());

      const userStakeBalanceBefore = await stakeRepToken.balanceOf(stakerB.address);
      const stakeTokenBalanceBefore = await stakingToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardToken.balanceOf(stakerB.address);

      const amountUnstaked = 2n;

      // Call to exit with locked funds that are not passed the lock time
      await stakingERC721.connect(stakerB).exit([tokenIdD, tokenIdE], true);

      const userStakeBalanceAfter = await stakeRepToken.balanceOf(stakerB.address);
      const stakeTokenBalanceAfter = await stakingToken.balanceOf(stakerB.address);
      const rewardsBalanceAfter = await rewardToken.balanceOf(stakerB.address);

      // Confirm no rewards were given
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
      expect(userStakeBalanceAfter).to.eq(userStakeBalanceBefore - amountUnstaked);
      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + amountUnstaked);

      const stakerData = await stakingERC721.nftStakers(stakerB.address);

      // Resets all `locked` user variables
      expect(stakerData.unlockedTimestamp).to.eq(0);
      expect(stakerData.amountStakedLocked).to.eq(0);
      expect(stakerData.lastTimestampLocked).to.eq(0);
      expect(stakerData.owedRewardsLocked).to.eq(0);

      // Non locked funds were not effected
      expect(stakerData.amountStaked).to.eq(1n);
      expect(stakerData.lastTimestamp).to.eq(stakedAtUnlocked);
      expect(stakerData.owedRewards).to.eq(0); // Have not tallied internally yet
    });

    it("Allows the user to remove multiple stakes within the timelock period without rewards", async () => {
      // Stake multiple
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      await stakingERC721.connect(stakerA).stakeWithLock(
        [tokenIdA, tokenIdB, tokenIdC],
        [emptyUri, emptyUri, emptyUri],
        DEFAULT_LOCK
      );

      const stakeBalanceBefore = await stakeRepToken.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakingToken.balanceOf(stakerA.address);
      const rewardsBalanceBefore = await rewardToken.balanceOf(stakerA.address);

      await time.increase(DEFAULT_LOCK);

      // Verify we can remove multiple stakes in a single tx
      await stakingERC721.connect(stakerA).exit([tokenIdA, tokenIdB, tokenIdC], true);

      const stakeBalanceAfter = await stakeRepToken.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakingToken.balanceOf(stakerA.address);
      const rewardsBalanceAfter = await rewardToken.balanceOf(stakerA.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - 3n);
      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + 3n);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
    });

    it("Fails when not providing full list of owned tokenIds", async () => {
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      amountStakedLocked = 3n;
      await stakingERC721.connect(stakerA).stakeWithLock(
        [tokenIdA, tokenIdB, tokenIdC],
        [emptyUri, emptyUri, emptyUri],
        DEFAULT_LOCK
      );
      stakedAtLocked = BigInt(await time.latest());

      // Try to do a partial exit, confirm it will revert
      await expect(
        stakingERC721.connect(stakerA).exit([tokenIdA, tokenIdB], true)
      ).to.be.revertedWithCustomError(stakingERC721, NOT_FULL_EXIT_ERR);
    });

    it("Fails when any of the incoming tokenIds are invalid", async () => {
      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      expect(stakerDataBefore.amountStakedLocked).to.eq(amountStakedLocked);
      expect(stakerDataBefore.lastTimestampLocked).to.eq(stakedAtLocked);
      expect(stakerDataBefore.owedRewards).to.eq(0n); // Not tallied yet

      // Try to do a partial exit, confirm it will revert
      // It hits `NotFullExit` condition before it can validate if invalid tokenID exists
      await expect(
        stakingERC721.connect(stakerA).exit([tokenIdA, tokenIdB, unmintedTokenId], true)
      ).to.be.revertedWithCustomError(stakingERC721, NOT_FULL_EXIT_ERR);
    });

    it("Fails when any of the incoming tokenIds are not owned by the caller", async () => {
      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      expect(stakerDataBefore.amountStakedLocked).to.eq(amountStakedLocked);
      expect(stakerDataBefore.lastTimestampLocked).to.eq(stakedAtLocked);
      expect(stakerDataBefore.owedRewards).to.eq(0n); // Not tallied yet

      // Try to do a partial exit, confirm it will revert
      // Will hit `NotFullExit` condition in loop before it can validate owner
      await expect(
        stakingERC721.connect(stakerA).exit([tokenIdA, tokenIdB, tokenIdD], true)
      ).to.be.revertedWithCustomError(stakingERC721, NOT_FULL_EXIT_ERR);
    });

    it("Fails when mix of locked and unlocked tokens are provided", async () => {
      await reset();

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      await stakingERC721.connect(stakerA).stakeWithLock(
        [tokenIdA, tokenIdB],
        [emptyUri, emptyUri],
        DEFAULT_LOCK
      );

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdC], [emptyUri]);

      await expect(
        stakingERC721.connect(stakerA).exit([tokenIdA, tokenIdC], true)
      ).to.be.revertedWithCustomError(stakingERC721, NOT_FULL_EXIT_ERR);
    });

    it("Fails when canExit is false", async () => {
      await stakingERC721.connect(owner).setExit(false);

      await expect(
        stakingERC721.connect(stakerA).exit([tokenIdA, tokenIdB], true)
      ).to.be.revertedWithCustomError(stakingERC721, CANNOT_EXIT_ERR);

      await expect(
        stakingERC721.connect(stakerA).exit([tokenIdC], false)
      ).to.be.revertedWithCustomError(stakingERC721, CANNOT_EXIT_ERR);

    });
    it("Succeeds when canExit is true", async ()=> {
      await stakingERC721.connect(owner).setExit(true);

      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);
      const rewardsBefore = await rewardToken.balanceOf(stakerA.address);

      expect(stakerDataBefore.amountStakedLocked).to.eq(2n);
      expect(stakerDataBefore.amountStaked).to.eq(1n);

      await stakingERC721.connect(stakerA).exit([tokenIdA, tokenIdB], true);
      await stakingERC721.connect(stakerA).exit([tokenIdC], false);

      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);
      const rewardsAfter = await rewardToken.balanceOf(stakerA.address);

      expect(stakerDataAfter.amountStakedLocked).to.eq(0n);
      expect(stakerDataAfter.amountStaked).to.eq(0n);
      expect(rewardsAfter).to.eq(rewardsBefore);
    });
  });

  describe("Events", () => {
    it("Staking emits a 'Staked' event", async () => {
      await reset();

      // Transfer back to staker so they can trigger the `Staked` event
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);

      await expect(stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]))
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(stakerA.address, tokenIdA);

      firstStakedAtA = BigInt(await time.latest());
    });

    it("Emits Staked event when calling with lock", async () => {
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdD);

      await expect(stakingERC721.connect(stakerB).stakeWithLock([tokenIdD], [emptyUri], DEFAULT_LOCK))
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(stakerB.address, tokenIdD);

      firstStakedAtB = BigInt(await time.latest());
    });

    it("Staking multiple tokens emits multiple 'Staked' events", async () => {
      // Transfer back to staker so they can trigger the `Staked` event
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      await expect(await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdB, tokenIdC], [emptyUri, emptyUri]))
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(stakerA.address, tokenIdB)
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(stakerA.address, tokenIdC);

      secondStakedAtA = BigInt(await time.latest());
    });

    it("Emits multiple staked events when calling with lock for multiple tokens", async () => {
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdE);
      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdF);

      await expect(await stakingERC721.connect(stakerB).stakeWithLock(
        [tokenIdE, tokenIdF],
        [emptyUri, emptyUri],
        DEFAULT_LOCK
      )).to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(stakerB.address, tokenIdE)
        .to.emit(stakingERC721, STAKED_EVENT)
        .withArgs(stakerB.address, tokenIdF);

      secondStakedAtB = BigInt(await time.latest());
    });

    it("Claim emits a 'Claimed' event", async () => {
      await reset();

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await expect(stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]));
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 5n);

      const latest = BigInt(await time.latest());

      const futureExpectedRewardsA = calcStakeRewards(
        await stakeRepToken.balanceOf(stakerA.address),
        latest - stakedAt,
        false,
        config
      );

      await expect(await stakingERC721.connect(stakerA).claim())
        .to.emit(stakingERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, futureExpectedRewardsA);
    });

    it("Unstake Emits 'Unstaked' and 'Claimed 'events", async () => {
      await reset();

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await expect(stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]));
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 5n);

      const latest = BigInt(await time.latest());
      const futureExpectedRewardsA = calcTotalUnlockedRewards(
        [latest - stakedAt],
        [1n],
        config
      );

      await expect(
        await stakingERC721.connect(stakerA).unstakeUnlocked([tokenIdA])
      ).to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdA)
        .to.emit(stakingERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, futureExpectedRewardsA);
    });

    it("Unstaking multiple tokens emits multiple 'Unstaked' events", async () => {
      await reset();

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await expect(stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdB, tokenIdC], [emptyUri, emptyUri]));
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 5n);

      const latest = BigInt(await time.latest());
      const futureExpectedRewards = calcTotalUnlockedRewards(
        [latest - stakedAt],
        [await stakeRepToken.balanceOf(stakerA.address)],
        config
      );

      await expect(await stakingERC721.connect(stakerA).unstakeUnlocked([tokenIdB, tokenIdC]))
        .to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdB)
        .to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdC)
        .to.emit(stakingERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, futureExpectedRewards);
    });
  });

  describe("Other configs", () => {
    it("Can set the rewards token as native token", async () => {
      await reset();

      const localContract : StakingERC721 = await getNativeSetupERC721(
        owner,
        stakingToken,
        stakeRepToken
      );

      await stakingToken.connect(stakerA).approve(await localContract.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await localContract.getAddress(), tokenIdB);

      // Stake without a lock
      await localContract.connect(stakerA).stakeWithoutLock([tokenIdA, tokenIdB], [emptyUri, emptyUri]);
      const stakedAt = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 3n);

      const rewardsBefore = await hre.ethers.provider.getBalance(stakerA.address);

      // Claim after time has passed
      const claimTx = await localContract.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const stakerData = await localContract.nftStakers(stakerA.address);

      const claimReceipt = await claimTx.wait();

      const claimRewards = calcStakeRewards(
        stakerData.amountStaked,
        claimedAt - stakedAt,
        false,
        config
      );

      const rewardsAfterClaim = await hre.ethers.provider.getBalance(stakerA.address);

      // Confirm rewards in native token
      expect(rewardsAfterClaim).to.eq(
        rewardsBefore + claimRewards - (claimReceipt!.gasUsed * claimReceipt!.gasPrice)
      );

      expect(stakerData.owedRewards).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(claimedAt);
      expect(stakerData.amountStaked).to.eq(2n); // Unchanged after claim

      // No locked stake
      expect(stakerData.amountStakedLocked).to.eq(0n);
      expect(stakerData.owedRewardsLocked).to.eq(0n);
      expect(stakerData.lastTimestampLocked).to.eq(0n);

      await time.increase(DEFAULT_LOCK / 3n);

      // Partial unstake
      const amountUnstaked = 1n; // Rewards are given for full balance before unstaking
      const partialUnstakeTx = await localContract.connect(stakerA).unstakeUnlocked([tokenIdA]);
      const partialUnstakedAt = BigInt(await time.latest());

      const partialUnstakeReceipt = await partialUnstakeTx.wait();
      const stakerDataAfter = await localContract.nftStakers(stakerA.address);

      const rewardsAfterUnstake = await hre.ethers.provider.getBalance(stakerA.address);

      const partialUnstakeRewards = calcStakeRewards(
        stakerDataAfter.amountStaked + amountUnstaked,
        partialUnstakedAt - claimedAt,
        false,
        config
      );

      expect(rewardsAfterUnstake).to.eq(
        rewardsAfterClaim + partialUnstakeRewards - (partialUnstakeReceipt!.gasUsed * partialUnstakeReceipt!.gasPrice)
      );

      expect(stakerDataAfter.owedRewards).to.eq(0n);
      expect(stakerDataAfter.lastTimestamp).to.eq(partialUnstakedAt);
      expect(stakerDataAfter.amountStaked).to.eq(1n); // Decrement after partial unstake

      // No locked stake
      expect(stakerDataAfter.amountStakedLocked).to.eq(0n);
      expect(stakerDataAfter.owedRewardsLocked).to.eq(0n);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(0n);

      // Full unstake
      await time.increase(DEFAULT_LOCK / 5n);

      const fullUnstakeTx = await localContract.connect(stakerA).unstakeUnlocked([tokenIdB]);
      const fullUnstakedAt = BigInt(await time.latest());

      const fullUnstakeReceipt = await fullUnstakeTx.wait();

      const rewardsAfterFullUnstake = await hre.ethers.provider.getBalance(stakerA.address);

      const fullUnstakeRewards = calcStakeRewards(
        stakerDataAfter.amountStaked,
        fullUnstakedAt - partialUnstakedAt,
        false,
        config
      );

      expect(rewardsAfterFullUnstake).to.eq(
        rewardsAfterUnstake + fullUnstakeRewards
        - (fullUnstakeReceipt!.gasUsed * fullUnstakeReceipt!.gasPrice)
      );

      const stakerDataFinal = await localContract.nftStakers(stakerA.address);

      // Delete staker struct on full unstake
      expect(stakerDataFinal.owedRewards).to.eq(0n);
      expect(stakerDataFinal.lastTimestamp).to.eq(0n);
      expect(stakerDataFinal.amountStaked).to.eq(0n);

      // No locked stake
      expect(stakerDataFinal.amountStakedLocked).to.eq(0n);
      expect(stakerDataFinal.owedRewardsLocked).to.eq(0n);
      expect(stakerDataFinal.lastTimestampLocked).to.eq(0n);
    });

    it("Can set the rewards token as native token when locking", async () => {
      await reset();

      const localContract : StakingERC721 = await getNativeSetupERC721(
        owner,
        stakingToken,
        stakeRepToken
      );

      await stakingToken.connect(stakerA).approve(await localContract.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await localContract.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await localContract.getAddress(), tokenIdC);

      await localContract.connect(stakerA).stakeWithLock([tokenIdA, tokenIdB], [emptyUri, emptyUri], DEFAULT_LOCK);
      const stakedAtLocked = BigInt(await time.latest());

      await localContract.connect(stakerA).stakeWithoutLock([tokenIdC], [emptyUri]);
      const stakedAt = BigInt(await time.latest());

      const dataAfterStakes = await localContract.nftStakers(stakerA.address);

      // Pre calculated lock stake value
      const lockedRewards = calcStakeRewards(
        dataAfterStakes.amountStakedLocked,
        DEFAULT_LOCK,
        true,
        config
      );

      expect(dataAfterStakes.amountStaked).to.eq(1n);
      expect(dataAfterStakes.amountStakedLocked).to.eq(2n);
      expect(dataAfterStakes.lastTimestamp).to.eq(stakedAt);
      expect(dataAfterStakes.lastTimestampLocked).to.eq(stakedAtLocked);
      expect(dataAfterStakes.unlockedTimestamp).to.eq(stakedAtLocked + DEFAULT_LOCK);
      expect(dataAfterStakes.owedRewards).to.eq(0n);
      expect(dataAfterStakes.owedRewardsLocked).to.eq(lockedRewards);

      await time.increase(DEFAULT_LOCK / 3n);

      const rewardsBefore = await hre.ethers.provider.getBalance(stakerA.address);

      // first claim, before unlockedTimestamp so no locked rewards
      const claimTx = await localContract.connect(stakerA).claim();
      const claimedAt = BigInt(await time.latest());

      const claimReceipt = await claimTx.wait();
      const stakerData = await localContract.nftStakers(stakerA.address);

      const claimRewards = calcStakeRewards(
        stakerData.amountStaked,
        claimedAt - stakedAt,
        false,
        config
      );

      const rewardsAfterClaim = await hre.ethers.provider.getBalance(stakerA.address);

      // Confirm we don't receive rewards from stake that is still locked when calling `claim`
      expect(rewardsAfterClaim).to.eq(
        rewardsBefore + claimRewards - (claimReceipt!.gasUsed * claimReceipt!.gasPrice)
      );

      expect(stakerData.owedRewards).to.eq(0n);
      expect(stakerData.lastTimestamp).to.eq(claimedAt);
      expect(stakerData.amountStaked).to.eq(dataAfterStakes.amountStaked); // Unchanged after claim
      expect(stakerData.amountStakedLocked).to.eq(dataAfterStakes.amountStakedLocked); // Unchanged after claim
      expect(stakerData.unlockedTimestamp).to.eq(stakedAtLocked + DEFAULT_LOCK); // Unchanged after claim
      expect(stakerData.owedRewardsLocked).to.eq(lockedRewards);
      expect(stakerData.lastTimestampLocked).to.eq(stakedAtLocked);

      // Move time forward to unlock the stake
      await time.increase(DEFAULT_LOCK);

      // second claim, after unlockedTimestamp so includes locked rewards
      const fullClaimTx = await localContract.connect(stakerA).claim();
      const fullClaimedAt = BigInt(await time.latest());

      const fullClaimReceipt = await fullClaimTx.wait();
      const dataAfterFullClaim = await localContract.nftStakers(stakerA.address);

      const unlockedRewards = calcStakeRewards(
        stakerData.amountStaked,
        fullClaimedAt - claimedAt,
        false,
        config
      );

      const interimRewards = calcStakeRewards(
        stakerData.amountStakedLocked,
        fullClaimedAt - stakerData.unlockedTimestamp,
        false,
        config
      );

      const rewardsAfterFullClaim = await hre.ethers.provider.getBalance(stakerA.address);

      // Includes pre-calculated `lockedRewards`
      expect(rewardsAfterFullClaim).to.eq(
        rewardsAfterClaim + lockedRewards + interimRewards + unlockedRewards
        - (fullClaimReceipt!.gasUsed * fullClaimReceipt!.gasPrice)
      );

      expect(dataAfterFullClaim.owedRewards).to.eq(0n);
      expect(dataAfterFullClaim.owedRewardsLocked).to.eq(0n);
      expect(dataAfterFullClaim.lastTimestamp).to.eq(fullClaimedAt);
      expect(dataAfterFullClaim.lastTimestampLocked).to.eq(fullClaimedAt);
      expect(dataAfterFullClaim.amountStaked).to.eq(dataAfterStakes.amountStaked);
      expect(dataAfterFullClaim.amountStakedLocked).to.eq(dataAfterStakes.amountStakedLocked);
      expect(dataAfterFullClaim.unlockedTimestamp).to.eq(stakedAtLocked + DEFAULT_LOCK);

      // Partial unstake
      const partialUnstakeTx = await localContract.connect(stakerA).unstakeLocked([tokenIdA]);
      const partialUnstakedAt = BigInt(await time.latest());

      const partialUnstakeReceipt = await partialUnstakeTx.wait();

      const dataAfterPartialUnstake = await localContract.nftStakers(stakerA.address);

      const rewardsAfterUnstake = await hre.ethers.provider.getBalance(stakerA.address);

      const unstakeRewards = calcStakeRewards(
        1n,
        partialUnstakedAt - fullClaimedAt + 1n,
        false,
        config
      );

      expect(rewardsAfterUnstake).to.eq(
        rewardsAfterFullClaim + unstakeRewards - (partialUnstakeReceipt!.gasUsed * partialUnstakeReceipt!.gasPrice)
      );

      expect(dataAfterPartialUnstake.owedRewards).to.eq(0n);
      expect(dataAfterPartialUnstake.lastTimestamp).to.eq(fullClaimedAt);
      expect(dataAfterPartialUnstake.lastTimestampLocked).to.eq(partialUnstakedAt); // shouldnt be 0
      expect(dataAfterPartialUnstake.amountStaked).to.eq(1n); // Decrement after partial unstake
      expect(dataAfterPartialUnstake.amountStakedLocked).to.eq(1n);
      expect(dataAfterPartialUnstake.owedRewardsLocked).to.eq(0n);
      expect(dataAfterPartialUnstake.unlockedTimestamp).to.eq(stakedAtLocked + DEFAULT_LOCK);

      // Full unstake locked
      await time.increase(DEFAULT_LOCK / 5n);

      const fullLockedUnstakeTx = await localContract.connect(stakerA).unstakeLocked([tokenIdB]);
      const fullLockedUnstakedAt = BigInt(await time.latest());

      const fullLockedUnstakedReceipt = await fullLockedUnstakeTx.wait();

      const rewardsAfterFullLockedUnstake = await hre.ethers.provider.getBalance(stakerA.address);

      // Already received locked rewards when calling claim after lock period ended
      // user only gets interim rewards here
      const fullLockedUnstakeRewards = calcStakeRewards(
        1n,
        fullLockedUnstakedAt - partialUnstakedAt,
        false,
        config
      );

      expect(rewardsAfterFullLockedUnstake).to.eq(
        rewardsAfterUnstake + fullLockedUnstakeRewards
        - (fullLockedUnstakedReceipt!.gasPrice * fullLockedUnstakedReceipt!.gasUsed)
      );

      const dataAfterFullLockedUnstake = await localContract.nftStakers(stakerA.address);

      // Full unstake locked resets all staker locked variables
      expect(dataAfterFullLockedUnstake.owedRewardsLocked).to.eq(0n);
      expect(dataAfterFullLockedUnstake.amountStakedLocked).to.eq(0n);
      expect(dataAfterFullLockedUnstake.lastTimestampLocked).to.eq(0n);
      expect(dataAfterFullLockedUnstake.unlockedTimestamp).to.eq(0n);

      // Full unstake unlocked
      const fullUnlockedUnstakeTx = await localContract.connect(stakerA).unstakeUnlocked([tokenIdC]);
      const fullUnlockedUnstakedAt = BigInt(await time.latest());

      const fullUnstakeReceipt = await fullUnlockedUnstakeTx.wait();

      const rewardsAfterFullUnstake = await hre.ethers.provider.getBalance(stakerA.address);

      const fullUnstakeRewards = calcStakeRewards(
        dataAfterPartialUnstake.amountStaked,
        fullUnlockedUnstakedAt - fullClaimedAt,
        false,
        config
      );

      expect(rewardsAfterFullUnstake).to.eq(
        rewardsAfterFullLockedUnstake + fullUnstakeRewards
        - BigInt(fullUnstakeReceipt!.gasUsed * fullUnstakeReceipt!.gasPrice)
      );

      const stakerDataFinal = await localContract.nftStakers(stakerA.address);

      // Delete staker struct on full unstake
      expect(stakerDataFinal.owedRewards).to.eq(0n);
      expect(stakerDataFinal.lastTimestamp).to.eq(0n);
      expect(stakerDataFinal.amountStaked).to.eq(0n);

      // No locked stake
      expect(stakerDataFinal.owedRewardsLocked).to.eq(0n);
      expect(stakerDataFinal.amountStakedLocked).to.eq(0n);
      expect(stakerDataFinal.lastTimestampLocked).to.eq(0n);
      expect(stakerDataFinal.unlockedTimestamp).to.eq(0n);
    });

    it("Can't use the StakingERC721 contract when an IERC20 is the staking token", async () => {
      const localConfig = {
        stakingToken: await rewardToken.getAddress(),
        rewardsToken: await stakingToken.getAddress(),
        stakeRepToken: await stakeRepToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
        minimumLockTime: DEFAULT_MINIMUM_LOCK,
        minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
        maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
        contractOwner: owner.address,
        canExit: true,
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        localConfig
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
        await localStakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FUNCTION_SELECTOR_ERR);
      }
    });

    it("Can't use the StakingERC721 contract when an IERC721 is the rewards token", async () => {
      await reset();

      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await stakingToken.getAddress(),
        stakeRepToken: await stakeRepToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
        minimumLockTime: DEFAULT_MINIMUM_LOCK,
        minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
        maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
        contractOwner: owner.address,
        canExit: true,

      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        localConfig
      ) as StakingERC721;

      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      await stakeRepToken.connect(owner).grantRole(
        await stakeRepToken.MINTER_ROLE(),
        await localStakingERC721.getAddress()
      );
      await stakeRepToken.connect(owner).grantRole(
        await stakeRepToken.BURNER_ROLE(),
        await localStakingERC721.getAddress()
      );

      await localStakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);

      // reward token for local contract is 721
      // provide balance to avoid `InsufficientContractBalance` error
      await stakingToken.connect(owner).mint(
        await localStakingERC721.getAddress(),
        BigInt("1010101")
      );

      try {
        // In this flow balance is checked before trying to transfer, and so this will
        // fail first, can't seem to check the normal way using `revertedWith`
        await localStakingERC721.connect(stakerA).unstakeUnlocked([tokenIdA]);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FAILED_INNER_CALL_ERR);
      }
    });

    it("Can't transfer rewards when there is no rewards balance", async () => {
      await reset();

      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await rewardToken.getAddress(),
        stakeRepToken: await stakeRepToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        minimumLockTime: DEFAULT_MINIMUM_LOCK,
        minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
        maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
        contractOwner: owner.address,
        canExit: true,
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        localConfig
      ) as StakingERC721;

      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);
      await stakeRepToken.connect(owner).grantRole(
        await stakeRepToken.MINTER_ROLE(),
        await localStakingERC721.getAddress()
      );

      await localStakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);

      await time.increase(DEFAULT_LOCK / 3n);

      const rewardsInPool = await localStakingERC721.getContractRewardsBalance();
      expect(rewardsInPool).to.eq(0);

      // Strangely this error isn't caught with the usual `await expect(...).to.be.revertedWith(...)`
      // use this instead
      try {
        await localStakingERC721.connect(stakerA).claim();
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_BALANCE_ERR);
      }
    });
  });

  describe("Utility functions + ZeroVotingERC721 standard functions", () => {
    it("Calculates the users rewards when they lock based on their lock time", async () => {
      await reset();

      const timeDuration = DEFAULT_LOCK;
      const unlocked = await stakingERC721.connect(owner).getStakeRewards(1n, timeDuration, false);
      const locked = await stakingERC721.connect(owner).getStakeRewards(1n, timeDuration, true);

      const stakeValue = calcStakeRewards(
        1n,
        timeDuration,
        true,
        config
      );

      expect(stakeValue).to.eq(locked);

      // Uncomment when testing different parameters
      // console.log("Locked rewards:   ", locked.toString());
      // console.log("Unlocked rewards: ", unlocked.toString());
      expect(locked).to.be.gt(unlocked);

      // This also double checks that the helper method to calc rewards returns
      // the same values as if using the contract methods
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdB], [emptyUri]);

      await time.increase(DEFAULT_LOCK - 1n);

      const rewardsBefore = await rewardToken.balanceOf(stakerA.address);

      await stakingERC721.connect(stakerA).claim();

      const rewardsAfter = await rewardToken.balanceOf(stakerA.address);

      expect(rewardsAfter).to.eq(rewardsBefore + unlocked);
    });

    it("#setBaseURI() should set the base URI", async () => {
      await reset();

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);

      const newBaseUri = "https://newbaseuri.com/";
      await stakeRepToken.connect(owner).setBaseURI(newBaseUri);

      expect(await stakeRepToken.tokenURI(tokenIdA)).to.eq(newBaseUri + tokenIdA);
    });

    it("#setTokenURI() should set the token URI and return it properly when baseURI is empty", async () => {
      const newTokenUri = "https://newtokenuri.com/";
      await stakeRepToken.connect(owner).setBaseURI("");
      await stakeRepToken.connect(owner).setTokenURI(tokenIdA, newTokenUri);

      const uriFromContract = await stakeRepToken.tokenURI(tokenIdA);

      expect(uriFromContract).to.eq(newTokenUri);
    });

    // eslint-disable-next-line max-len
    it("#stake() with passed tokenURI should set the token URI when baseURI is empty and change back to baseURI when needed", async () => {
      // Make available for current test by unstaking
      await reset();

      const newTokenUri = "https://specialtokenuri.com/";

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [newTokenUri]);

      const uriFromContract = await stakeRepToken.tokenURI(tokenIdA);
      expect(uriFromContract).to.eq(baseUri + newTokenUri);

      await stakeRepToken.connect(owner).setBaseURI(baseUri);
      await stakeRepToken.connect(owner).setTokenURI(tokenIdA, "");

      const newURI = await stakeRepToken.tokenURI(tokenIdA);
      expect(newURI).to.eq(baseUri + tokenIdA);
    });

    it("#withdrawLeftoverRewards() should withdraw all remaining rewards and emit an event", async () => {
      const contractBalBefore = await rewardToken.balanceOf(await stakingERC721.getAddress());
      expect(contractBalBefore).to.be.gt(0);

      await expect(
        stakingERC721.connect(owner).withdrawLeftoverRewards()
      ).to.emit(stakingERC721, WITHDRAW_EVENT)
        .withArgs(owner.address, contractBalBefore);

      const contractBalAfter = await rewardToken.balanceOf(await stakingERC721.getAddress());
      expect(contractBalAfter).to.eq(0);
    });

    it("#withdrawLeftoverRewards() should revert if contract balance is 0", async () => {
      await expect(
        stakingERC721.connect(owner).withdrawLeftoverRewards()
      ).to.be.revertedWithCustomError(stakingERC721, INSUFFICIENT_CONTRACT_BALANCE_ERR);
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

      const stakingInterface = await stakeRepToken.getInterfaceId();

      expect(await stakeRepToken.supportsInterface(erc721InterfaceId)).to.eq(true);
      expect(await stakeRepToken.supportsInterface(stakingInterface)).to.eq(true);
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

  describe("Audit", () => {
    it("6.1 - Unstaking with exit allows unauthorized rewards claim", async () => {
      await reset();

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK);

      let stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);
      let stakedAt = BigInt(await time.latest());

      const expectedStakeRewards = calcStakeRewards(
        stakerDataBefore.amountStakedLocked,
        DEFAULT_LOCK,
        true,
        config
      );

      expect(stakerDataBefore.owedRewardsLocked).to.eq(expectedStakeRewards);
      expect(stakerDataBefore.amountStakedLocked).to.eq(1n);
      expect(stakerDataBefore.lastTimestampLocked).to.eq(stakedAt);
      expect(stakerDataBefore.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);

      await stakingERC721.connect(stakerA).exit([tokenIdA], true);

      let stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);

      // Because no tokens are left staked at all
      // the entire staker struct is deleted here.
      expect(stakerDataAfter.owedRewardsLocked).to.eq(0n);
      expect(stakerDataAfter.amountStakedLocked).to.eq(0n);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(0n);
      expect(stakerDataAfter.unlockedTimestamp).to.eq(0n);

      // Do again without relying on staker struct being deleted
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);

      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK);
      stakedAt = BigInt(await time.latest());

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdB], [emptyUri]);
      const stakedAtUnlocked = BigInt(await time.latest());

      await time.increase(DEFAULT_LOCK / 2n);

      // Update stakerDataBefore
      stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      expect(stakerDataBefore.owedRewardsLocked).to.eq(expectedStakeRewards);
      expect(stakerDataBefore.amountStakedLocked).to.eq(1n);
      expect(stakerDataBefore.lastTimestampLocked).to.eq(stakedAt);
      expect(stakerDataBefore.unlockedTimestamp).to.eq(stakedAt + DEFAULT_LOCK);

      // Haven't tallied unlocked rewards yet so will still show 0
      expect(stakerDataBefore.owedRewards).to.eq(0n);
      expect(stakerDataBefore.amountStaked).to.eq(1n);
      expect(stakerDataBefore.lastTimestamp).to.eq(stakedAtUnlocked);

      // exit with `locked` as true
      await stakingERC721.connect(stakerA).exit([tokenIdA], true);

      stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);

      // Confirm unlocked stake and rewards are untouched
      expect(stakerDataAfter.owedRewards).to.eq(0n);
      expect(stakerDataAfter.amountStaked).to.eq(1n);
      expect(stakerDataAfter.lastTimestamp).to.eq(stakedAtUnlocked);

      // Confirm all values are set to 0
      expect(stakerDataAfter.owedRewardsLocked).to.eq(0n);
      expect(stakerDataAfter.amountStakedLocked).to.eq(0n);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(0n);
      expect(stakerDataAfter.unlockedTimestamp).to.eq(0n);

      // exit for unlocked token as well
      await stakingERC721.connect(stakerA).exit([tokenIdB], false);

      stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);

      // Confirm all values have been set to 0
      expect(stakerDataAfter.owedRewards).to.eq(0n);
      expect(stakerDataAfter.amountStaked).to.eq(0n);
      expect(stakerDataAfter.lastTimestamp).to.eq(0n);
    });

    it("6.4 - User loses rewards when unstaking partial amounts", async () => {
      await reset();

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      const amountStaked = 3n;
      await stakingERC721.connect(stakerA).stakeWithoutLock(
        [tokenIdA, tokenIdB, tokenIdC],
        [emptyUri, emptyUri, emptyUri]
      );

      const stakedAt = BigInt(await time.latest());

      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      expect(stakerDataBefore.amountStaked).to.eq(amountStaked);
      expect(stakerDataBefore.lastTimestamp).to.eq(stakedAt);
      expect(stakerDataBefore.owedRewards).to.eq(0n); // Not tallied yet

      await time.increase(DAY_IN_SECONDS * 92n);

      const rewardsBalanceBefore = await rewardToken.balanceOf(stakerA.address);

      // Partial unstake
      const amountUnstaked = 1n;
      await stakingERC721.connect(stakerA).unstakeUnlocked([tokenIdA]);
      const unstakedAt = BigInt(await time.latest());

      const rewardsBalanceAfter = await rewardToken.balanceOf(stakerA.address);

      // Calculating expected rewards based on entire staked balance
      const expectedStakeRewards = calcStakeRewards(
        stakerDataBefore.amountStaked,
        unstakedAt - stakedAt,
        false,
        config
      );

      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore + expectedStakeRewards);
      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);

      expect(stakerDataAfter.amountStaked).to.eq(amountStaked - amountUnstaked);
      expect(stakerDataAfter.lastTimestamp).to.eq(unstakedAt);
      expect(stakerDataAfter.owedRewards).to.eq(0n); // Just gave rewards to staker
    });

    it("6.5 - Array length manipulation allows partial exit in _unstakeMany(...)", async () => {
      await reset();

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      const amountStaked = 3n;
      await stakingERC721.connect(stakerA).stakeWithoutLock(
        [tokenIdA, tokenIdB, tokenIdC],
        [emptyUri, emptyUri, emptyUri]
      );

      const stakedAt = BigInt(await time.latest());

      let stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      expect(stakerDataBefore.amountStaked).to.eq(amountStaked);
      expect(stakerDataBefore.lastTimestamp).to.eq(stakedAt);
      expect(stakerDataBefore.owedRewards).to.eq(0n); // Not tallied yet

      // Try to do a partial exit
      // confirm it will revert on owner check in `onlySNFTOwner` if we submit an invalid array of tokenIds
      await expect(
        stakingERC721.connect(stakerA).exit([tokenIdA, unstakedTokenId, unmintedTokenId], false)
      ).to.be.revertedWithCustomError(stakeRepToken, NONEXISTENT_TOKEN_ERR);

      // Confirm again with locked stake
      await stakingERC721.connect(stakerA).exit([tokenIdA, tokenIdB, tokenIdC], false);

      // Reapprove staking contract
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdB);
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdC);

      // Restake
      const amountStakedLocked = 3n;
      await stakingERC721.connect(stakerA).stakeWithLock(
        [tokenIdA, tokenIdB, tokenIdC],
        [emptyUri, emptyUri, emptyUri],
        DEFAULT_LOCK
      );

      const stakedAtLocked = BigInt(await time.latest());

      stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      expect(stakerDataBefore.amountStakedLocked).to.eq(amountStakedLocked);
      expect(stakerDataBefore.lastTimestampLocked).to.eq(stakedAtLocked);
      expect(stakerDataBefore.owedRewards).to.eq(0n); // Not tallied yet

      // Try to do a partial exit, confirm it will revert, this time using real tokenIds but not the
      // correct owner
      await expect(
        stakingERC721.connect(stakerA).exit([tokenIdA, unstakedTokenId, unmintedTokenId], true)
      ).to.be.revertedWithCustomError(stakingERC721, NOT_FULL_EXIT_ERR);
    });
  });
});
