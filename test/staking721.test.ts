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
  createDefaultConfig,
  STAKED_EVENT,
  CLAIMED_EVENT,
  UNSTAKED_EVENT,
  BaseConfig,
  WITHDRAW_EVENT,
  DEFAULT_LOCK,
  calcTotalUnlockedRewards,
  PRECISION_DIVISOR,
  LOCKED_PRECISION_DIVISOR,
  DAY_IN_SECONDS,
  calcStakeRewards,
  DEFAULT_MINIMUM_LOCK,
  DEFAULT_MINIMUM_RM,
  DEFAULT_MAXIMUM_RM,
} from "./helpers/staking";
import {
  FAILED_INNER_CALL_ERR,
  FUNCTION_SELECTOR_ERR,
  ZERO_INIT_ERR,
  NON_TRANSFERRABLE_ERR,
  INCORRECT_OWNER_ERR,
  NONEXISTENT_TOKEN_ERR,
  INSUFFICIENT_APPROVAL_721_ERR,
  OWNABLE_UNAUTHORIZED_ERR,
  ZERO_REWARDS_ERR,
  INVALID_UNSTAKE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  INSUFFICIENT_CONTRACT_BALANCE_ERR,
  LOCK_TOO_SHORT_ERR,
  NOT_FULL_EXIT_ERR,
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
  const unStakedTokenId = 12n; // Minted but never used in stake
  const unmintedTokenId = 13n; // Never minted

  const baseUri = "0://staked-nfts";
  const emptyUri = "";

  /* eslint-disable-next-line @typescript-eslint/no-empty-function */
  let reset = async () => { };

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

      config = await createDefaultConfig(rewardToken, owner, stakingToken);

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      stakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        config
      );

      stakingERC721Address = await stakingERC721.getAddress();

      // Give staking contract balance to pay rewards
      await rewardToken.connect(owner).transfer(
        await stakingERC721.getAddress(),
        hre.ethers.parseEther("999999999")
      );

      await stakingToken.connect(owner).mint(stakerA.address, tokenIdA);
      await stakingToken.connect(owner).mint(stakerA.address, tokenIdB);
      await stakingToken.connect(owner).mint(stakerA.address, tokenIdC);

      await stakingToken.connect(owner).mint(stakerB.address, tokenIdD);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdE);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdF);
      await stakingToken.connect(owner).mint(stakerB.address, tokenIdG);

      await stakingToken.connect(owner).mint(stakerC.address, tokenIdH);
      await stakingToken.connect(owner).mint(stakerC.address, tokenIdI);
      await stakingToken.connect(owner).mint(stakerC.address, tokenIdJ);

      await stakingToken.connect(owner).mint(owner.address, unStakedTokenId);

      await stakingToken.connect(stakerA).setApprovalForAll(await stakingERC721.getAddress(), true);
      await stakingToken.connect(stakerB).setApprovalForAll(await stakingERC721.getAddress(), true);
      await stakingToken.connect(stakerC).setApprovalForAll(await stakingERC721.getAddress(), true);
    };

    // Call to setup the first time
    await reset();
  });

  describe("#getContractRewardsBalance", () => {
    it("Allows a user to see the total rewards remaining in a pool", async () => {
      const rewardsInPool = await stakingERC721.getContractRewardsBalance();
      const poolBalance = await rewardToken.balanceOf(await stakingERC721.getAddress());
      expect(rewardsInPool).to.eq(poolBalance);
    });
  });

  describe("#stake", () => {
    it("Can stake a single NFT using #stakeWithoutLock", async () => {
      // stakerA starts with tokenA, tokenB, and tokenC
      const supplyBefore = await stakingERC721.totalSupply();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);
      firstStakedAtA = BigInt(await time.latest());

      const supplyAfter = await stakingERC721.totalSupply();

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

      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdD], [emptyUri], DEFAULT_LOCK);
      firstStakedAtB = BigInt(await time.latest());

      const supplyAfter = await stakingERC721.totalSupply();

      // Get balance of sNFTs
      // balanceAtStakeOneA = await stakingERC721.balanceOf(stakerB.address);

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
      expect(stakes[0]).to.eq(tokenIdD);
      expect(stakerData.lastTimestampLocked).to.eq(firstStakedAtB);
    });

    it("Can stake multiple NFTs using #stakeWithoutLock", async () => {
      // stakerA has tokenIdB and tokenIdC remaining, and stakes both
      const supplyBefore = await stakingERC721.totalSupply();

      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdB, tokenIdC], [emptyUri, emptyUri]);
      secondStakedAtA = BigInt(await time.latest());

      const supplyAfter = await stakingERC721.totalSupply();

      // balanceAtStakeTwoA = await stakingERC721.balanceOf(stakerA.address);

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
        DEFAULT_LOCK
      );

      secondStakedAtB = BigInt(await time.latest());

      const supplyAfter = await stakingERC721.totalSupply();

      // balanceAtStakeTwoA = await stakingERC721.balanceOf(stakerB.address);

      const stakerData = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);


      // const amountStaked = await stakingERC721.connect(stakerB).getAmountStaked();
      const tokenIds = await stakingERC721.connect(stakerB).getStakedTokenIds();

      expect(supplyAfter).to.eq(supplyBefore + 2n);

      // User still has tokenIdG
      expect(await stakingToken.balanceOf(stakerB.address)).to.eq(1);

      // User has staked tokenIdE and tokenIdF and gained two sNFTs, totalling 3
      expect(await stakingERC721.balanceOf(stakerB.address)).to.eq(3);

      expect(stakerData.amountStakedLocked).to.eq(tokenIds.length);
      expect(tokenIds[1]).to.eq(tokenIdE);
      expect(tokenIds[2]).to.eq(tokenIdF);

      expect(stakerData.lastTimestampLocked).to.eq(secondStakedAtB);
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
      const stakedAtFirst = BigInt(await time.latest());

      const timeIncrease = 100n;
      await time.increase(timeIncrease);

      // Existing lock is `DEFAULT_LOCK - 100s` now, so the incoming lock will be smaller and it should not update
      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdE], [emptyUri], DEFAULT_LOCK / 2n);
      const stakedAtSecond = BigInt(await time.latest());

      const stakerDataAfter = await stakingERC721.connect(stakerB).nftStakers(stakerB.address);

      // We increase the staker's lockDuration by the amount they already have configured
      // as the initial lockDuration
      expect(stakerDataAfter.unlockedTimestamp).to.eq(stakerDataBefore.unlockedTimestamp);
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

    it("Fails when the stakes is locked for less than the minimum lock time", async () => {
      await expect(
        stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_MINIMUM_LOCK - 1n)
      ).to.be.revertedWithCustomError(stakingERC721, LOCK_TOO_SHORT_ERR);
    });

    it("Fails to stake when the token id is invalid", async () => {
      // Token is not minted, and so is invalid
      await expect(
        stakingERC721.connect(stakerA).stakeWithoutLock([unmintedTokenId], [emptyUri])
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);

      await expect(
        stakingERC721.connect(stakerA).stakeWithLock([unmintedTokenId], [emptyUri], DEFAULT_LOCK)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(unmintedTokenId);
    });

    it("Fails to stake when the token is already staked", async () => {
      // If the token is staked, the owner will be the staking contract not the original owner
      await expect(
        stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri])
      ).to.be.revertedWithCustomError(stakingERC721, INCORRECT_OWNER_ERR)
        .withArgs(stakerA.address, tokenIdA, await stakingERC721.getAddress());

      await expect(
        stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK)
      ).to.be.revertedWithCustomError(stakingERC721, INCORRECT_OWNER_ERR)
        .withArgs(stakerA.address, tokenIdA, await stakingERC721.getAddress());
    });

    it("Fails to stake when the caller is not the owner of the NFT", async () => {
      // Staker does not own the token and cannot stake it
      await reset();

      await expect(
        stakingERC721.connect(stakerA).stakeWithoutLock([unStakedTokenId], [emptyUri])
      ).to.be.revertedWithCustomError(stakingERC721, INSUFFICIENT_APPROVAL_721_ERR)
        .withArgs(stakingERC721.target, unStakedTokenId);

      await expect(
        stakingERC721.connect(stakerA).stakeWithLock([tokenIdD], [emptyUri], DEFAULT_LOCK)
      ).to.be.revertedWithCustomError(stakingERC721, INCORRECT_OWNER_ERR)
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
      const stakedAt = BigInt(await time.latest());

      const tokenIds = await stakingERC721.connect(stakerB).getStakedTokenIds();

      const initPendingRewards = await stakingERC721.connect(stakerB).getPendingRewards();

      // If no time has passed, the value will be 0
      expect(initPendingRewards).to.eq(0);

      await time.increase(DEFAULT_LOCK / 2n);
      const latest = BigInt(await time.latest());

      const stakerData = await stakingERC721.nftStakers(stakerB.address);

      const pendingRewards = await stakingERC721.connect(stakerB).getPendingRewards();

      const stakeValue = calcStakeRewards(
        1n,
        DEFAULT_LOCK,
        true,
        config,
        stakerData.rewardsMultiplier
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

      const pendingRewards = await stakingERC721.connect(stakerA).getPendingRewards();

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

    it("Claims rewards when both locked and not locked stakes exist and the lock duration has passed", async () => {
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
        stakerDataBefore.rewardsMultiplier
      );

      const expectedLockedInterimRewards = calcStakeRewards(
        1n,
        claimedAt - stakerDataBefore.unlockedTimestamp,
        false,
        config
      );

      expect(balanceAfter).to.eq(
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

  describe("#unstake", () => {
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

      await stakingERC721.connect(stakerA).unstake([tokenIdA], false);
      unstakedAt = BigInt(await time.latest());

      const expectedUnlocked = calcStakeRewards(
        stakerDataBefore.amountStaked,
        unstakedAt - stakedAtUnlocked,
        false,
        config
      );

      const expectedLockedStakeValue = calcStakeRewards(
        stakerDataBefore.amountStakedLocked,
        DEFAULT_LOCK,
        true,
        config,
        stakerDataBefore.rewardsMultiplier
      );

      const expectedLockedInterimRewards = calcStakeRewards(
        stakerDataBefore.amountStakedLocked,
        unstakedAt - stakerDataBefore.unlockedTimestamp,
        false,
        config
      );

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      expect(balanceAfter).to.eq(balanceBefore + expectedUnlocked);

      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);

      // User has regained their NFT and the SNFT was burned
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(2);
      expect(stakerDataAfter.amountStaked).to.eq(0);
      expect(stakerDataAfter.lastTimestamp).to.eq(0); // because we fully withdrew non-locked funds, we reset
      expect(stakerDataAfter.owedRewards).to.eq(0n);

      // We are still staked with locked funds, and that is withheld in the staker data
      expect(stakerDataAfter.amountStakedLocked).to.eq(2);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(stakedAtLocked);

      // Confirm the sNFT was burned
      await expect(
        stakingERC721.ownerOf(tokenIdA)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR)
        .withArgs(tokenIdA);
    });

    it("Can unstake multiple tokens that have unlocked", async () => {
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
      await time.increase(DEFAULT_LOCK + 13n);

      const balanceBefore = await rewardToken.balanceOf(stakerA.address);

      const stakerDataBefore = await stakingERC721.nftStakers(stakerA.address);

      await stakingERC721.connect(stakerA).unstake([tokenIdB, tokenIdC], false);
      unstakedAt = BigInt(await time.latest());

      const balanceAfter = await rewardToken.balanceOf(stakerA.address);

      const lockedStakeRewards = calcStakeRewards(
        stakerDataBefore.amountStakedLocked,
        DEFAULT_LOCK,
        true,
        config,
        stakerDataBefore.rewardsMultiplier
      );

      const interimRewards = calcStakeRewards(
        stakerDataBefore.amountStakedLocked,
        unstakedAt - stakerDataBefore.unlockedTimestamp,
        false,
        config
      );

      // Rounding error, 1 in the difference for the real value. Calculations are correct but because
      // TypeScript has better math support we can't calculate to the same exact value.
      expect(balanceAfter).to.eq(balanceBefore + lockedStakeRewards + interimRewards - 1n);

      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);


      // User has regained their NFTs and the SNFT was burned
      expect(await stakingToken.balanceOf(stakerA.address)).to.eq(2); // unstaked two
      expect(await stakingERC721.balanceOf(stakerA.address)).to.eq(1); // one remains staked
      expect((await stakingERC721.nftStakers(stakerA.address)).amountStaked).to.eq(1);
      expect((await stakingERC721.nftStakers(stakerA.address)).amountStakedLocked).to.eq(0);

      // Staker data has been reset when they have completely unstaked
      // Because `unstake` also claims, the non-locked timestamp is updated as well
      expect(stakerDataAfter.lastTimestamp).to.eq(stakedAtUnlocked);
      expect(stakerDataAfter.lastTimestampLocked).to.eq(0n);
      expect(stakerDataAfter.lockDuration).to.eq(0n);
      expect(stakerDataAfter.amountStaked).to.eq(stakerDataBefore.amountStaked);
      expect(stakerDataAfter.amountStakedLocked).to.eq(stakerDataBefore.amountStakedLocked - 2n);
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

      await stakingERC721.connect(stakerA).stakeWithLock([tokenIdA], [emptyUri], DEFAULT_LOCK);

      await expect(
        stakingERC721.connect(stakerA).unstake([tokenIdA], false)
      ).to.be.revertedWithCustomError(stakingERC721, INVALID_UNSTAKE_ERR);
    });

    it("Fails to unstake when token id is invalid", async () => {
      // It will revert with the "ZeroRewards" error before it has a chance to check the token id

      await expect(
        stakingERC721.connect(stakerA).unstake([unmintedTokenId], false)
      ).to.be.revertedWithCustomError(stakingERC721, NONEXISTENT_TOKEN_ERR);

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

    it("Fails if the user tries to exit without specifying all their locked balance", async () => {
      await reset();

      await stakingERC721.connect(stakerB).stakeWithLock(
        [tokenIdD, tokenIdE, tokenIdF],
        [emptyUri, emptyUri, emptyUri],
        DEFAULT_LOCK
      );

      await time.increase(DEFAULT_LOCK / 2n);

      await expect(
        stakingERC721.connect(stakerB).unstake([tokenIdD], true)
      ).to.be.revertedWithCustomError(stakingERC721, NOT_FULL_EXIT_ERR);
    });

    it("Allows the user to remove their stake with `exit` within the timelock period without rewards", async () => {
      await reset();

      await stakingToken.connect(stakerB).approve(await stakingERC721.getAddress(), tokenIdD);
      await stakingERC721.connect(stakerB).stakeWithLock([tokenIdD], [emptyUri], DEFAULT_LOCK);

      const stakeBalanceBefore = await stakingERC721.balanceOf(stakerB.address);
      const stakeTokenBalanceBefore = await stakingToken.balanceOf(stakerB.address);
      const rewardsBalanceBefore = await rewardToken.balanceOf(stakerB.address);

      // unstake with `exit`
      await stakingERC721.connect(stakerB).unstake([tokenIdD], true);

      const stakeBalanceAfter = await stakingERC721.balanceOf(stakerB.address);
      const stakeTokenBalanceAfter = await stakingToken.balanceOf(stakerB.address);
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
        DEFAULT_LOCK
      );

      const stakeBalanceBefore = await stakingERC721.balanceOf(stakerA.address);
      const stakeTokenBalanceBefore = await stakingToken.balanceOf(stakerA.address);
      const rewardsBalanceBefore = await rewardToken.balanceOf(stakerA.address);

      // Verify we can remove multiple stakes in a single tx
      await stakingERC721.connect(stakerA).unstake([tokenIdA, tokenIdB, tokenIdC], true);

      const stakeBalanceAfter = await stakingERC721.balanceOf(stakerA.address);
      const stakeTokenBalanceAfter = await stakingToken.balanceOf(stakerA.address);
      const rewardsBalanceAfter = await rewardToken.balanceOf(stakerA.address);

      expect(stakeBalanceAfter).to.eq(stakeBalanceBefore - 3n);
      expect(stakeTokenBalanceAfter).to.eq(stakeTokenBalanceBefore + 3n);
      expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore);
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

      const futureExpectedRewardsA = calcTotalUnlockedRewards(
        [latest - stakedAt],
        [await stakingERC721.balanceOf(stakerA.address)],
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

      const stakeRewards = calcStakeRewards(
        1n,
        latest - stakedAt,
        false,
        config
      );

      await expect(
        await stakingERC721.connect(stakerA).unstake([tokenIdA], false)
      ).to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdA)
        .to.emit(stakingERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, stakeRewards);
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
        [await stakingERC721.balanceOf(stakerA.address)],
        config
      );

      await expect(await stakingERC721.connect(stakerA).unstake([tokenIdB, tokenIdC], false))
        .to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdB)
        .to.emit(stakingERC721, UNSTAKED_EVENT)
        .withArgs(stakerA.address, tokenIdC)
        .to.emit(stakingERC721, CLAIMED_EVENT)
        .withArgs(stakerA.address, futureExpectedRewards);
    });
  });

  describe("Other configs", () => {
    it("Can't use the StakingERC721 contract when an IERC20 is the staking token", async () => {
      const localConfig = {
        stakingToken: await rewardToken.getAddress(),
        rewardsToken: await stakingToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
        minimumLockTime: DEFAULT_MINIMUM_LOCK,
        divisor: PRECISION_DIVISOR,
        lockedDivisor: LOCKED_PRECISION_DIVISOR,
        minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
        maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
        contractOwner: owner.address,
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig
      ) as StakingERC721;

      // Realistically, they should never approve the contract for erc20 spending
      await rewardToken.connect(stakerA).approve(await localStakingERC721.getAddress(), hre.ethers.MaxUint256);
      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

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
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        timeLockPeriod: BigInt(1),
        minimumLockTime: DEFAULT_MINIMUM_LOCK,
        divisor: PRECISION_DIVISOR,
        lockedDivisor: LOCKED_PRECISION_DIVISOR,
        minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
        maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
        contractOwner: owner.address,
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig
      ) as StakingERC721;

      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      await localStakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);

      await time.increase(DEFAULT_LOCK / 4n);

      try {
        // In this flow balance is checked before trying to transfer, and so this will
        // fail first, can't seem to check the normal way using `revertedWith`
        await localStakingERC721.connect(stakerA).unstake([tokenIdA], false);
      } catch (e : unknown) {
        expect((e as Error).message).to.include(FAILED_INNER_CALL_ERR);
      }

      // To be sure balance check isn't the failure, we give balance of many NFTs so the
      // number is similar
      const pendingRewardsTotal = await localStakingERC721.connect(stakerA).getPendingRewards();
      const pendingRewards = await localStakingERC721.connect(stakerA).getPendingRewards();

      const bal = await stakingToken.balanceOf(await localStakingERC721.getAddress());

      // Provide enough rewards so the contract passes the "No rewards balance" error
      // 14 is offset for number already in existence, and 100 is a buffer for amount over the rewards we need
      for (let i = 14; i < pendingRewards + 100n; i++) {
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

    it("Can't transfer rewards when there is no rewards balance", async () => {
      await reset();

      const localConfig = {
        stakingToken: await stakingToken.getAddress(),
        rewardsToken: await rewardToken.getAddress(),
        rewardsPerPeriod: BigInt(1),
        periodLength: BigInt(1),
        divisor: PRECISION_DIVISOR,
        minimumLockTime: DEFAULT_MINIMUM_LOCK,
        lockedDivisor: LOCKED_PRECISION_DIVISOR,
        minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
        maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
        contractOwner: owner.address,
      } as BaseConfig;

      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
      const localStakingERC721 = await stakingFactory.deploy(
        "StakingNFT",
        "SNFT",
        baseUri,
        localConfig
      ) as StakingERC721;

      await stakingToken.connect(stakerA).approve(await localStakingERC721.getAddress(), tokenIdA);

      await localStakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);

      await time.increase(DEFAULT_LOCK / 3n);

      const rewardsBalance = await rewardToken.balanceOf(await localStakingERC721.getAddress());

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

  describe("Utility functions", () => {
    it("Calculates the users rewards when they lock based on their lock time", async () => {
      await reset();

      // TODO find good config values for rewards to make sense again in 721
      const timeDuration = DAY_IN_SECONDS * 69n;
      const unlockedRewards = await stakingERC721.connect(owner).getStakeRewards(1n, timeDuration, false);
      const lockedRewards = await stakingERC721.connect(owner).getStakeRewards(1n, timeDuration, true);
      console.log(lockedRewards);
      console.log(unlockedRewards);
    });

    it("Should NOT deploy with zero values passed", async () => {
      const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");

      let localConfig = config;
      localConfig.stakingToken = hre.ethers.ZeroAddress;

      await expect(
        stakingFactory.deploy(
          "StakingNFT",
          "SNFT",
          baseUri,
          config
        )
      ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);

      localConfig = config;
      localConfig.rewardsToken = hre.ethers.ZeroAddress;

      await expect(
        stakingFactory.deploy(
          "StakingNFT",
          "SNFT",
          baseUri,
          config
        )
      ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);

      localConfig = config;
      localConfig.rewardsPerPeriod = 0n;

      await expect(
        stakingFactory.deploy(
          "StakingNFT",
          "SNFT",
          baseUri,
          config
        )
      ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);

      localConfig = config;
      localConfig.periodLength = 0n;

      await expect(
        stakingFactory.deploy(
          "StakingNFT",
          "SNFT",
          baseUri,
          config
        )
      ).to.be.revertedWithCustomError(stakingERC721, ZERO_INIT_ERR);
    });

    it("Gas test", async () => {
      await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerA.address, tokenIdD);
      await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerA.address, tokenIdE);
      await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerA.address, tokenIdF);
      await stakingToken.connect(stakerB).transferFrom(stakerB.address, stakerA.address, tokenIdG);

      await stakingToken.connect(stakerC).transferFrom(stakerC.address, stakerA.address, tokenIdH);
      await stakingToken.connect(stakerC).transferFrom(stakerC.address, stakerA.address, tokenIdI);
      await stakingToken.connect(stakerC).transferFrom(stakerC.address, stakerA.address, tokenIdJ);

      await stakingToken.connect(stakerA).setApprovalForAll(await stakingERC721.getAddress(), true);

      await stakingERC721.connect(stakerA).stakeWithLock(
        [
          tokenIdA,
          tokenIdB,
          tokenIdC,
          tokenIdD,
          tokenIdE,
          tokenIdF,
          tokenIdG,
          tokenIdH,
          tokenIdI,
          tokenIdJ,
        ],
        [
          emptyUri,
          emptyUri,
          emptyUri,
          emptyUri,
          emptyUri,
          emptyUri,
          emptyUri,
          emptyUri,
          emptyUri,
          emptyUri,
        ],
        DEFAULT_LOCK
      );

      const stakerData = await stakingERC721.nftStakers(stakerA.address);

      expect(stakerData.amountStakedLocked).to.eq(10);

      await time.increase(DEFAULT_LOCK);

      await stakingERC721.connect(stakerA).claim();

      await stakingERC721.connect(stakerA).unstake(
        [
          tokenIdA,
          tokenIdB,
          tokenIdC,
          tokenIdD,
          tokenIdE,
          tokenIdF,
          tokenIdG,
          tokenIdH,
          tokenIdI,
        ],
        false
      );

      const stakerDataAfter = await stakingERC721.nftStakers(stakerA.address);
      expect(stakerDataAfter.amountStakedLocked).to.eq(1);

    });

    it("#setBaseURI() should set the base URI", async () => {
      await reset();

      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [emptyUri]);

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
      await stakingToken.connect(stakerA).approve(await stakingERC721.getAddress(), tokenIdA);
      await stakingERC721.connect(stakerA).stakeWithoutLock([tokenIdA], [newTokenUri]);

      const uriFromContract = await stakingERC721.tokenURI(tokenIdA);
      expect(uriFromContract).to.eq(newTokenUri);

      await stakingERC721.connect(owner).setBaseURI(baseUri);
      await stakingERC721.connect(owner).setTokenURI(tokenIdA, "");

      const newURI = await stakingERC721.tokenURI(tokenIdA);
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
