import * as hre from "hardhat";
import { BaseContract, ethers } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import {
  MockERC20,
  MockERC721,
  Staking,
} from "../typechain";
import { mine, reset } from "@nomicfoundation/hardhat-network-helpers";
import {
  POOL_NOT_EXIST,
  INVALID_TOKEN_ID,
  ONLY_NFT_OWNER,
  ONLY_SNFT_OWNER,
} from "./helpers/errors";
import {
  StakingConfig,
  MultiStakingV6,
} from "./helpers/types";
// eslint-disable-next-line @typescript-eslint/no-var-requires

// Test core requirements for Staking

// Priority #1 - Staking
// 1.1 - User visits a staking website (possibly a zApp).
// 1.2 - User can stake their NFT (e.g., Wilder Wheel)
// 1.3 - User receives staked NFT in return
// 1.4 - User receives a Race Pass (new contract)
// 1.5 - User receives a percentage of rewards on an epoch (passive rewards)
// 1.6 - User can unstake at any time.

describe("Staking", () => {
  let deployer: SignerWithAddress;
  let staker: SignerWithAddress;

  let mockERC20: MockERC20;
  let mockERC721: MockERC721;

  describe("Staking", () => {
    let deployer: SignerWithAddress;
    let staker: SignerWithAddress;

    let stakingContract: Staking;

    let mockERC20: MockERC20;
    let mockERC721: MockERC721;

    type StakingConfig = {
      stakingToken: string;
      rewardsToken: string;
      rewardsPerBlock: string;
    }

    let config: StakingConfig;
    let tokenId: number;

    before(async () => {
      [
        deployer,
        staker,
      ] = await hre.ethers.getSigners();

      const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
      mockERC20 = await mockERC20Factory.deploy("MEOW", "MEOW");

      const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");
      mockERC721 = await mockERC721Factory.deploy("WilderWheels", "WW", "0://wheels-base");

      config = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        rewardsPerBlock: hre.ethers.parseEther("100").toString(),
      }

      const stakingFactory = await hre.ethers.getContractFactory("Staking");
      stakingContract = await stakingFactory.deploy("StakingNFT", "SNFT", config);

      // Give staking contract balance to pay rewards (maybe house these in a vault of some kind)
      mockERC20.connect(deployer).transfer(await stakingContract.getAddress(), hre.ethers.parseEther("1000000"));

      tokenId = 1;
    });

    it("Can stake an NFT", async () => {
      await mockERC721.connect(deployer).mint(staker.address, tokenId);

      await mockERC721.connect(staker).approve(await stakingContract.getAddress(), tokenId);

      await stakingContract.connect(staker).stake(tokenId);

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(staker.address)).to.eq(0);
      expect(await stakingContract.balanceOf(staker.address)).to.eq(1);
    });

    it("Can claim rewards on a staked token", async () => {
      const blocks = 10;
      await mine(blocks);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await stakingContract.connect(staker).claim(tokenId);

      const rewardsPerBlock = (await stakingContract.config()).rewardsPerBlock;

      const balanceAfter = await mockERC20.balanceOf(staker.address);

      // We do blocks + 1 because the claim call is executed on a new block in testing
      expect(balanceAfter).to.be.gt(balanceBefore + (rewardsPerBlock * BigInt(blocks + 1)));
    });

    it("Can unstake a token", async () => {
      const blocks = 10;
      await mine(blocks);

      const balanceBefore = await mockERC20.balanceOf(staker.address);

      await stakingContract.connect(staker).unstake(tokenId);

      const rewardsPerBlock = (await stakingContract.config()).rewardsPerBlock;

      const balanceAfter = await mockERC20.balanceOf(staker.address);

      // We do blocks + 1 because the unstake call is executed on a new block in testing
      expect(balanceAfter).to.be.gt(balanceBefore + (rewardsPerBlock * BigInt(blocks + 1)));
    });

    it("Can call burn on a token that is not owned by the contract?", async () => {
      // first mint and stake a token, then call to unstake it and see if burn succeeds


      // const blocks = 10;
      // await mine(blocks);

      // // Staker will now have given up NFT but received an SNFT
      // // does "_burn" succeed?
      // const balanceBefore = await mockERC20.balanceOf(staker.address);

      // await stakingContract.connect(staker).unstake(tokenId);

      // const rewardsPerBlock = (await stakingContract.config()).rewardsPerBlock;

      // const balanceAfter = await mockERC20.balanceOf(staker.address);

      // // We do blocks + 1 because the unstake call is executed on a new block in testing
      // expect(balanceAfter).to.be.gt(balanceBefore.add(rewardsPerBlock.mul(blocks + 1)));

      // // cannot unstake twice
      // await expect(stakingContract.connect(staker).unstake(tokenId)).to.be.reverted;
    });
  });

  describe.only("MultiStaking", async () => {
    let deployer: SignerWithAddress;
    let stakerA: SignerWithAddress;
    let stakerB: SignerWithAddress;
    let notStaker: SignerWithAddress;

    let stakingContract: MultiStakingV6;

    let mockERC20: MockERC20;
    let mockERC721: MockERC721;

    let defaultPool: StakingConfig;
    let defaultPoolId: string;

    let defaultStakeIdA: string;
    let defaultStakeIdB: string;

    const defaultTokenIdA: number = 1;
    const defaultTokenIdB: number = 2;

    // TODO move to helper?
    // would require params, don't really want that necessarily
    let resetContracts: Function;
    // dont necessarily need handles to the `let vars` above,
    // can just do redploy and then catch outside of the function as
    // [mockERC20, mockERC721, stakingContract] = await resetContracts();

    before(async () => {
      [
        deployer,
        stakerA,
        stakerB,
        notStaker,
      ] = await hre.ethers.getSigners();

      resetContracts = async () => {
        const mockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
        mockERC20 = await mockERC20Factory.deploy("MEOW", "MEOW");

        const mockERC721Factory = await hre.ethers.getContractFactory("MockERC721");
        mockERC721 = await mockERC721Factory.deploy("WilderWheels", "WW", "0://wheels-base");

        const stakingFactory = await hre.ethers.getContractFactory("MultiStaking");
        stakingContract = await hre.upgrades.deployProxy(
          stakingFactory,
          [
            "StakingNFT",
            "SNFT",
          ]
        ) as MultiStakingV6;

        // Create a default staking pool configuration
        defaultPool = {
          stakingToken: await mockERC721.getAddress(),
          rewardsToken: await mockERC20.getAddress(),
          rewardsPerBlock: hre.ethers.parseEther("100").toString(),
        }

        // Register initial staking pool
        await stakingContract.connect(deployer).createPool(defaultPool);
        defaultPoolId = await stakingContract.getPoolId(defaultPool);

        await mockERC20.connect(deployer).transfer(await stakingContract.getAddress(), hre.ethers.parseEther("9000000000"));

        // stakeId created by calling `.stake(defaultPoolId, defaultTokenIdA)`
        defaultStakeIdA = hre.ethers.solidityPackedKeccak256(
          ["bytes32", "uint256"],
          [defaultPoolId, defaultTokenIdA]
        );

        // stakeId created by calling `.stake(defaultPoolId, defaultTokenIdB)`
        defaultStakeIdB = hre.ethers.solidityPackedKeccak256(
          ["bytes32", "uint256"],
          [defaultPoolId, defaultTokenIdB]
        );

        // Mint NFTs for stakers
        await mockERC721.connect(deployer).mint(stakerA.address, defaultTokenIdA);
        await mockERC721.connect(deployer).mint(stakerB.address, defaultTokenIdB);

        // Approve the staking contract for stakers.
        await mockERC721.connect(stakerA).approve(await stakingContract.getAddress(), defaultTokenIdA);
        await mockERC721.connect(stakerB).approve(await stakingContract.getAddress(), defaultTokenIdB);
      }

      // Initial deployment
      await resetContracts();
    });

    // Single user, single pool
    it("Allows a user to stake in a single pool", async () => {
      await mockERC721.connect(stakerA).approve(await stakingContract.getAddress(), defaultTokenIdA);

      // Stake NFT
      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingContract.balanceOf(stakerA.address)).to.eq(1);
    });

    it("Allows a user to claim rewards from a single pool", async () => {
      // Expect token is staked
      expect(await stakingContract.stakedOrClaimedAt(defaultStakeIdA)).to.not.eq(0);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      await stakingContract.connect(stakerA).claim(defaultPoolId, defaultStakeIdA);

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      const rewardsPerBlock = (await stakingContract.configs(defaultPoolId)).rewardsPerBlock;

      expect(balanceAfter).to.eq(balanceBefore + rewardsPerBlock);
      expect(await stakingContract.stakedOrClaimedAt(defaultStakeIdA)).to.eq(await hre.ethers.provider.getBlockNumber());
    });

    it("Allows a user to unstake a token from a pool", async () => {
      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      await stakingContract.connect(stakerA).unstake(defaultPoolId, defaultTokenIdA);

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      const rewardsPerBlock = (await stakingContract.configs(defaultPoolId)).rewardsPerBlock;

      // We do + 1 because the unstake call is executed on a new block in testing
      expect(balanceAfter).to.eq(balanceBefore + rewardsPerBlock);
      expect(await stakingContract.stakedOrClaimedAt(defaultStakeIdA)).to.eq(0);

      // User has unstaked their NFT, getting it back and burning the SNFT
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingContract.balanceOf(stakerA.address)).to.eq(0);

      // SNFT has been burned
      await expect(stakingContract.ownerOf(defaultTokenIdA)).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    // single user, multiple pools
    it("Allows a user to stake in multiple pools", async () => {
      await resetContracts();

      const localConfig = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(), 
        rewardsPerBlock: hre.ethers.parseEther("101").toString(),
      }

      // Create a new staking pool
      await stakingContract.connect(deployer).createPool(localConfig);
      const localPoolId = await stakingContract.getPoolId(localConfig);

      // Create new token for user
      const newTokenId = 3;
      await mockERC721.connect(deployer).mint(stakerA, newTokenId);
      await mockERC721.connect(stakerA).approve(await stakingContract.getAddress(), newTokenId);

      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);
      await stakingContract.connect(stakerA).stake(localPoolId, newTokenId);

      expect(await stakingContract.balanceOf(stakerA.address)).to.eq(2);
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(0);
      expect(await mockERC721.balanceOf(await stakingContract.getAddress())).to.eq(2);  
    });

    it("Allows a user to claim rewards from multiple pools", async () => {
      const localConfig = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(), 
        rewardsPerBlock: hre.ethers.parseEther("101").toString(),
      }

      const localPoolId = await stakingContract.getPoolId(localConfig);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      const newTokenId = 3;
      const newStakeId = hre.ethers.solidityPackedKeccak256(
        ["bytes32", "uint256"],
        [localPoolId, newTokenId]
      );

      await stakingContract.connect(stakerA).claim(defaultPoolId, defaultStakeIdA);
      await stakingContract.connect(stakerA).claim(localPoolId, newStakeId);

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      const rewardsPerBlock = (await stakingContract.configs(defaultPoolId)).rewardsPerBlock;
      const rewardsPerBlockLocal = (await stakingContract.configs(localPoolId)).rewardsPerBlock;

      expect(balanceAfter).to.eq(balanceBefore + (rewardsPerBlock * 2n) + (rewardsPerBlockLocal * 2n));
    });

    it("Allows a user to unstake from multiple pools", async () => {
      const localConfig = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(), 
        rewardsPerBlock: hre.ethers.parseEther("101").toString(),
      }

      const localPoolId = await stakingContract.getPoolId(localConfig);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      const newTokenId = 3;

      await stakingContract.connect(stakerA).unstake(defaultPoolId, defaultTokenIdA);
      await stakingContract.connect(stakerA).unstake(localPoolId, newTokenId);

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      const rewardsPerBlock = (await stakingContract.configs(defaultPoolId)).rewardsPerBlock;
      const rewardsPerBlockLocal = (await stakingContract.configs(localPoolId)).rewardsPerBlock;

      expect(balanceAfter).to.eq(balanceBefore + (rewardsPerBlock * 2n) + (rewardsPerBlockLocal * 2n));
    });

    // multiple users, single pool
    it("Allows multiple users to stake in a single pool", async () => {
      await resetContracts();

      // Stake token for stakerA
      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);

      // Stake token for stakerB
      await stakingContract.connect(stakerB).stake(defaultPoolId, defaultTokenIdB);

      // Expect both stakers to have an SNFT
      expect(await stakingContract.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingContract.balanceOf(stakerB.address)).to.eq(1);

      // Expect the stakingContract to have two original NFTs
      expect(await mockERC721.balanceOf(await stakingContract.getAddress())).to.eq(2);
    });

    it("Allows multiple users to claim from a single pool", async () => {
      // Check balances individually because of weirdness with HH block mining
      const balanceBeforeA = await mockERC20.balanceOf(stakerA.address);
      const txA = await stakingContract.connect(stakerA).claim(defaultPoolId, defaultStakeIdA);
      const balanceAfterA = await mockERC20.balanceOf(stakerA.address);

      const balanceBeforeB = await mockERC20.balanceOf(stakerB.address);
      // why 0 => 200000000000000000000n in a single claim?
      const txB = await stakingContract.connect(stakerB).claim(defaultPoolId, defaultStakeIdB);
      const balanceAfterB = await mockERC20.balanceOf(stakerB.address);

      // Expect both stakers to have an SNFT
      expect(balanceAfterA).to.eq(balanceBeforeA + BigInt(defaultPool.rewardsPerBlock) * 2n);
      expect(balanceAfterB).to.eq(balanceBeforeB + BigInt(defaultPool.rewardsPerBlock) * 2n);

      // Expect stakedOrClaimedAt to have been updated
      expect(await stakingContract.stakedOrClaimedAt(defaultStakeIdA)).to.eq(txA.blockNumber);
      expect(await stakingContract.stakedOrClaimedAt(defaultStakeIdB)).to.eq(txB.blockNumber);

      // Expect the stakingContract to have two original NFTs
      expect(await mockERC721.balanceOf(await stakingContract.getAddress())).to.eq(2);
    });

    it("Allows multiple users to unstake from a single pool", async () => {
      const balanceBeforeA = await mockERC20.balanceOf(stakerA.address);
      const balanceBeforeB = await mockERC20.balanceOf(stakerB.address);

      await stakingContract.connect(stakerA).unstake(defaultPoolId, defaultTokenIdA);
      await stakingContract.connect(stakerB).unstake(defaultPoolId, defaultTokenIdB);

      const balanceAfterA = await mockERC20.balanceOf(stakerA.address);
      const balanceAfterB = await mockERC20.balanceOf(stakerB.address);

      // Expect both stakers to have an SNFT
      expect(balanceAfterA).to.eq(balanceBeforeA + BigInt(defaultPool.rewardsPerBlock) * 2n);
      expect(balanceAfterB).to.eq(balanceBeforeB + BigInt(defaultPool.rewardsPerBlock) * 2n);

      // Expect the stakingContract to have 0 original NFTs
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(1);
      expect(await mockERC721.balanceOf(stakerB.address)).to.eq(1);
      expect(await mockERC721.balanceOf(await stakingContract.getAddress())).to.eq(0);

      // Both NFTs are returned to the correct users
      expect(await mockERC721.ownerOf(defaultTokenIdA)).to.eq(stakerA.address);
      expect(await mockERC721.ownerOf(defaultTokenIdB)).to.eq(stakerB.address);
    });

    // multiple users, multiple pools
    it("Allows multiple users to stake in multiple pools", async () => {
      await resetContracts();

      const localConfig = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        rewardsPerBlock: hre.ethers.parseEther("101").toString(),
      }

      // Create a new staking pool
      await stakingContract.connect(deployer).createPool(localConfig);
      const localPoolId = await stakingContract.getPoolId(localConfig);

      let newTokenA = 5;
      let newTokenB = 6;

      // Mint new tokens
      await mockERC721.connect(deployer).mint(stakerA.address, newTokenA);
      await mockERC721.connect(deployer).mint(stakerB.address, newTokenB);

      // Approve staking contract
      await mockERC721.connect(stakerA).approve(await stakingContract.getAddress(), newTokenA);
      await mockERC721.connect(stakerB).approve(await stakingContract.getAddress(), newTokenB);

      // Stake token for stakerA
      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);
      await stakingContract.connect(stakerA).stake(localPoolId, newTokenA);

      // Stake token for stakerB
      await stakingContract.connect(stakerB).stake(defaultPoolId, defaultTokenIdB);
      await stakingContract.connect(stakerB).stake(localPoolId, newTokenB);

      // Expect both stakers to have two SNFT
      expect(await stakingContract.balanceOf(stakerA.address)).to.eq(2);
      expect(await stakingContract.balanceOf(stakerB.address)).to.eq(2);

      // Expect the stakingContract to have 4 original NFTs
      expect(await mockERC721.balanceOf(await stakingContract.getAddress())).to.eq(4);
    });

    it("Allows multiple users to claim from multiple pools", async () => {
      const localConfig = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        rewardsPerBlock: hre.ethers.parseEther("101").toString(),
      }

      const localPoolId = await stakingContract.getPoolId(localConfig);

      const balanceBeforeA = await mockERC20.balanceOf(stakerA.address);
      const balanceBeforeB = await mockERC20.balanceOf(stakerB.address);

      let newTokenA = 5;
      let newTokenB = 6;

      const newStakeIdA = hre.ethers.solidityPackedKeccak256(
        ["bytes32", "uint256"],
        [localPoolId, newTokenA]
      );

      const newStakeIdB = hre.ethers.solidityPackedKeccak256(
        ["bytes32", "uint256"],
        [localPoolId, newTokenB]
      );

      await stakingContract.connect(stakerA).claim(defaultPoolId, defaultStakeIdA);
      await stakingContract.connect(stakerA).claim(localPoolId, newStakeIdA);

      await stakingContract.connect(stakerB).claim(defaultPoolId, defaultStakeIdB);
      await stakingContract.connect(stakerB).claim(localPoolId, newStakeIdB);

      const balanceAfterA = await mockERC20.balanceOf(stakerA.address);
      const balanceAfterB = await mockERC20.balanceOf(stakerB.address);

      const rewardsPerBlock = (await stakingContract.configs(defaultPoolId)).rewardsPerBlock;
      const rewardsPerBlockLocal = (await stakingContract.configs(localPoolId)).rewardsPerBlock;

      expect(balanceAfterA).to.eq(balanceBeforeA + (rewardsPerBlock * 4n) + (rewardsPerBlockLocal * 4n));
      expect(balanceAfterB).to.eq(balanceBeforeB + (rewardsPerBlock * 4n) + (rewardsPerBlockLocal * 4n));
    });

    it("Allows multiple users to unstake from multiple pools", async () => {
      const localConfig = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        rewardsPerBlock: hre.ethers.parseEther("101").toString(),
      }

      const localPoolId = await stakingContract.getPoolId(localConfig);

      const balanceBeforeA = await mockERC20.balanceOf(stakerA.address);
      const balanceBeforeB = await mockERC20.balanceOf(stakerB.address);

      let newTokenA = 5;
      let newTokenB = 6;

      await stakingContract.connect(stakerA).unstake(defaultPoolId, defaultTokenIdA);
      await stakingContract.connect(stakerA).unstake(localPoolId, newTokenA);

      await stakingContract.connect(stakerB).unstake(defaultPoolId, defaultTokenIdB);
      await stakingContract.connect(stakerB).unstake(localPoolId, newTokenB);

      const balanceAfterA = await mockERC20.balanceOf(stakerA.address);
      const balanceAfterB = await mockERC20.balanceOf(stakerB.address);

      const rewardsPerBlock = (await stakingContract.configs(defaultPoolId)).rewardsPerBlock;
      const rewardsPerBlockLocal = (await stakingContract.configs(localPoolId)).rewardsPerBlock;

      expect(balanceAfterA).to.eq(balanceBeforeA + (rewardsPerBlock * 4n) + (rewardsPerBlockLocal * 4n));
      expect(balanceAfterB).to.eq(balanceBeforeB + (rewardsPerBlock * 4n) + (rewardsPerBlockLocal * 4n));
    });

    it("Fails when users try to stake valid tokens that aren't theirs", async () => {
      await resetContracts();

      // Stake token for stakerB usng stakerA
      await expect
        (
          stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdB)
        ).to.be.revertedWith(ONLY_NFT_OWNER);

      // Stake token for stakerA using stakerB
      await expect
        (
          stakingContract.connect(stakerB).stake(defaultPoolId, defaultTokenIdA)
        ).to.be.revertedWith(ONLY_NFT_OWNER);
    });

    it("Fails when users try to claim valid tokens that aren't theirs", async () => {
      await resetContracts();

      // Initial successful stakes
      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);
      await stakingContract.connect(stakerB).stake(defaultPoolId, defaultTokenIdB);

      await expect
        (
          stakingContract.connect(stakerA).claim(defaultPoolId, defaultStakeIdB)
        ).to.be.revertedWith(ONLY_SNFT_OWNER);

      await expect
        (
          stakingContract.connect(stakerB).claim(defaultPoolId, defaultStakeIdA)
        ).to.be.revertedWith(ONLY_SNFT_OWNER);
    });

    it("Fails when users try to unstake valid tokens that aren't theirs", async () => {

      await expect
        (
          stakingContract.connect(stakerA).unstake(defaultPoolId, defaultTokenIdB)
        ).to.be.revertedWith(ONLY_SNFT_OWNER);

      await expect
        (
          stakingContract.connect(stakerB).unstake(defaultPoolId, defaultTokenIdA)
        ).to.be.revertedWith(ONLY_SNFT_OWNER);
    });

    it("Fails when users try to stake non-existent tokens", async () => {
      const randomTokenId = 123;
      await expect
        (
          stakingContract.connect(stakerA).stake(defaultPoolId, randomTokenId)
        ).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails when users try to claim non-existent tokens", async () => {
      const randomTokenId = 123;
      const randomSNFT = hre.ethers.solidityPackedKeccak256(
        ["bytes32", "uint256"],
        [defaultPoolId, randomTokenId]
      );

      await expect
        (
          stakingContract.connect(stakerA).claim(defaultPoolId, randomSNFT)
        ).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails when users try to unstake non-existent tokens", async () => {
      const randomTokenId = 123;
      await expect
        (
          stakingContract.connect(stakerA).unstake(defaultPoolId, randomTokenId)
        ).to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails when users have valid stakes but claim using the wrong SNFT", async () => {
      await resetContracts();

      // Create initial valid stakes
      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);
      await stakingContract.connect(stakerB).stake(defaultPoolId, defaultTokenIdB);

      // Expect both stakers to have an SNFT
      expect(await stakingContract.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingContract.balanceOf(stakerB.address)).to.eq(1);

      // Expect claim to fail when using the wrong SNFT
      await expect
        (
          stakingContract.connect(stakerA).claim(defaultPoolId, defaultStakeIdB)
        ).to.be.revertedWith(ONLY_SNFT_OWNER);

      await expect
        (
          stakingContract.connect(stakerB).claim(defaultPoolId, defaultStakeIdA)
        ).to.be.revertedWith(ONLY_SNFT_OWNER);
    });

    it("Fails when users have valid stakes but unstake using the wrong SNFT", async () => {
      // Expect both stakers to have an SNFT
      expect(await stakingContract.balanceOf(stakerA.address)).to.eq(1);
      expect(await stakingContract.balanceOf(stakerB.address)).to.eq(1);

      // Expect claim to fail when using the wrong SNFT
      await expect
        (
          stakingContract.connect(stakerA).unstake(defaultPoolId, defaultTokenIdB)
        ).to.be.revertedWith(ONLY_SNFT_OWNER);

      await expect
        (
          stakingContract.connect(stakerB).unstake(defaultPoolId, defaultTokenIdA)
        ).to.be.revertedWith(ONLY_SNFT_OWNER);
    });

    it("Fails when you try to stake for a pool thats not setup by the admin", async () => {
      const config = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        rewardsPerBlock: hre.ethers.parseEther("1").toString(),
      }

      const poolId = await stakingContract.getPoolId(config);

      await expect(
        stakingContract.connect(stakerA).stake(poolId, defaultTokenIdA))
        .to.be.revertedWith(POOL_NOT_EXIST);
    });

    it("Fails when you try to claim from a pool thats not setup by the admin", async () => {
      // User wouldn't have a valid tokenId in this scenario because they only get it from staking
      // So fails with `ERC721: invalid token id`
      await resetContracts();

      const config = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        rewardsPerBlock: hre.ethers.parseEther("2").toString(),
        // Difference in rewardsPerBlock will create new stakingId
      }

      const stakingId = await stakingContract.getPoolId(config);

      await expect(
        stakingContract.connect(stakerA).claim(stakingId, defaultStakeIdA))
        .to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails when you try to unstake for a pool thats not setup by the admin", async () => {
      // User wouldn't have a valid tokenId in this scenario because they only get it from staking
      // So fails with `ERC721: invalid token id`
      const config = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        rewardsPerBlock: hre.ethers.parseEther("3").toString(),
        // Difference in rewardsPerBlock will create new stakingId
      }

      const stakingId = await stakingContract.getPoolId(config);

      await expect(
        stakingContract.connect(stakerA).unstake(stakingId, defaultTokenIdA))
        .to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails when you try to stake an already staked token", async () => {
      // First we must approve the contract again before a stake
      await mockERC721.connect(stakerA).approve(await stakingContract.getAddress(), defaultTokenIdA);

      // Stake token
      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);

      // Try to stake it again
      // Fails because the caller no longer owns the NFT to be staked
      await expect(
        stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA))
        .to.be.revertedWith(ONLY_NFT_OWNER);
    });

    it("Fails when you try to stake an already staked token in a different pool", async () => {
      await resetContracts();
      const localConfig = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(), 
        rewardsPerBlock: hre.ethers.parseEther("101").toString(),
      }

      // Create second pool to stake in
      await stakingContract.connect(deployer).createPool(localConfig);
      const localPoolId = await stakingContract.getPoolId(localConfig);

      // Stake token
      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);

      // Try to stake it again
      // Fails because the caller no longer owns the NFT to be staked
      await expect(
        stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA))
        .to.be.revertedWith(ONLY_NFT_OWNER);

      // Try to stake it in a different pool
      await expect(
        stakingContract.connect(stakerA).stake(localPoolId, defaultTokenIdA))
        .to.be.revertedWith(ONLY_NFT_OWNER);
    });

    it("Fails when you try to claim rewards on an unstaked token", async () => {
      // Unstake token
      await stakingContract.connect(stakerA).unstake(defaultPoolId, defaultTokenIdA);

      // Fails because the caller no longer owns the NFT to be claimed
      await expect(
        stakingContract.connect(stakerA).claim(defaultPoolId, defaultStakeIdA))
        .to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails when you try to unstake an already unstaked token", async () => {
      // Fails because the caller no longer owns the NFT to be unstaked
      await expect(
        stakingContract.connect(stakerA).unstake(defaultPoolId, defaultTokenIdA))
        .to.be.revertedWith(INVALID_TOKEN_ID);
    });

    it("Fails when staking a token that is not owned by the caller", async () => {
      // Assume that the correct staker called to approve already
      // Incorrect staker calling to approve a token thats not theirs would fail
      await mockERC721.connect(stakerA).approve(await stakingContract.getAddress(), defaultTokenIdA);

      // Stake token
      await expect(
        stakingContract.connect(notStaker).stake(defaultPoolId, defaultTokenIdA))
        .to.be.revertedWith(ONLY_NFT_OWNER);
    });

    it("Fails when unstaking a token that is not owned by the caller", async () => {
      // Assume that the correct staker called to approve already
      // Incorrect staker calling to approve a token thats not theirs would fail
      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);

      // Because currently staker owns the SNFT
      await expect(
        stakingContract.connect(notStaker).unstake(defaultPoolId, defaultTokenIdA))
        .to.be.revertedWith(ONLY_SNFT_OWNER);
    });

    it("Fails when claiming rewards on a token that is not owned by the caller", async () => {
      await expect(
        stakingContract.connect(notStaker).claim(defaultPoolId, defaultStakeIdA))
        .to.be.revertedWith(ONLY_SNFT_OWNER);
    });

    it("Fails when you try to unstake from a pool you are not staked in", async () => {
      await resetContracts();

      // Difference in rewardsPerBlock will create new stakingId
      const localConfig = {
        stakingToken: await mockERC721.getAddress(),
        rewardsToken: await mockERC20.getAddress(),
        rewardsPerBlock: hre.ethers.parseEther("50").toString(),
      }

      // Create a new staking pool
      await stakingContract.connect(deployer).createPool(localConfig);
      const localPoolId = await stakingContract.getPoolId(localConfig);

      // Stake in new pool
      await mockERC721.connect(stakerA).approve(await stakingContract.getAddress(), defaultTokenIdA);
      await stakingContract.connect(stakerA).stake(localPoolId, defaultTokenIdA);

      // Call for unstake from default pool fails, not staked on default pool
      await expect(
        stakingContract.connect(stakerA).unstake(defaultPoolId, defaultTokenIdA))
        .to.be.revertedWith(INVALID_TOKEN_ID);

      // Succeeeds when calling when unstaking from correct pool
      await expect(
        stakingContract.connect(stakerA).unstake(localPoolId, defaultTokenIdA))
        .to.not.be.reverted; // TODO improve test by checking for event emitted
    });

    // appropriate fails for when not admin (cannot setConfig or update existing configs)
    // gas tests
  });
});