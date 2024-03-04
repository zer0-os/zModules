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
    let deployer : SignerWithAddress;
    let staker : SignerWithAddress;
    
    let stakingContract : Staking;

    let mockERC20 : MockERC20;
    let mockERC721 : MockERC721;

    type StakingConfig = {
      stakingToken : string;
      rewardsToken : string;
      rewardsPerBlock : string;
    }

    let config : StakingConfig;
    let tokenId : number;

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
        stakingToken : await mockERC721.getAddress(),
        rewardsToken : await mockERC20.getAddress(),
        rewardsPerBlock : hre.ethers.parseEther("100").toString(),
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
    let deployer : SignerWithAddress;
    let stakerA : SignerWithAddress;
    let stakerB : SignerWithAddress;
    let notStaker : SignerWithAddress;

    let stakingContract : MultiStakingV6;

    let mockERC20 : MockERC20;
    let mockERC721 : MockERC721;

    let defaultPool : StakingConfig;
    let defaultPoolId : string;

    let defaultStakeIdA : string;
    let defaultStakeIdB : string;


    let defaultStakeIdDecimal : string;

    const defaultTokenIdA : number = 1;
    const defaultTokenIdB : number = 2;

    // TODO move to helper?
    // would require params, don't really want that necessarily
    let resetContracts : Function;
    // dont necessarily need handles to the `let vars` we above,
    // can just do redploy and then catch outside of the function

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
          stakingToken : await mockERC721.getAddress(),
          rewardsToken : await mockERC20.getAddress(),
          rewardsPerBlock : hre.ethers.parseEther("100").toString(),
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

        // Default stakeId in decimal form for lookup
        defaultStakeIdDecimal = BigInt(defaultStakeIdA).toString();
        await mockERC721.connect(deployer).mint(stakerA.address, defaultTokenIdA);
        await mockERC721.connect(deployer).mint(stakerB.address, defaultTokenIdB);
      }

      // Initial deployment
      await resetContracts();
    });

    it("User can stake an NFT", async () => {
      await mockERC721.connect(stakerA).approve(await stakingContract.getAddress(), defaultTokenIdA);

      // Stake NFT
      await stakingContract.connect(stakerA).stake(defaultPoolId, defaultTokenIdA);

      // User has staked their NFT and gained an SNFT
      expect(await mockERC721.balanceOf(stakerA.address)).to.eq(0);
      expect(await stakingContract.balanceOf(stakerA.address)).to.eq(1);
    });

    it("User can claim rewards on a staked token", async () => {
      // Expect token is staked
      expect(await stakingContract.stakedOrClaimedAt(defaultStakeIdA)).to.not.eq(0);

      const balanceBefore = await mockERC20.balanceOf(stakerA.address);

      await stakingContract.connect(stakerA).claim(defaultPoolId, defaultStakeIdA);

      const balanceAfter = await mockERC20.balanceOf(stakerA.address);

      const rewardsPerBlock = (await stakingContract.configs(defaultPoolId)).rewardsPerBlock;

      expect(balanceAfter).to.eq(balanceBefore + rewardsPerBlock);
      expect(await stakingContract.stakedOrClaimedAt(defaultStakeIdA)).to.eq(await hre.ethers.provider.getBlockNumber());
    });

    it("User can unstake a token", async () => {
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

    // multiple users, single pool
    it("Allows multiple users to stake in a single pool", async () => {
      // Approve
      await mockERC721.connect(stakerA).approve(await stakingContract.getAddress(), defaultTokenIdA);
      await mockERC721.connect(stakerB).approve(await stakingContract.getAddress(), defaultTokenIdB);

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







    // all multiple pools tests, single user
    it("Allows users to stake in multiple pools", async () => {
      const localConfig = {
        stakingToken : await mockERC721.getAddress(),
        rewardsToken : await mockERC20.getAddress(),
        rewardsPerBlock : hre.ethers.parseEther("101").toString(),
      }

      // Create a new staking pool
      await stakingContract.connect(deployer).createPool(localConfig);
      const localPoolId = await stakingContract.getPoolId(localConfig);
    
    });

    it("Allows users to claim rewards from multiple pools", async () => {
    });

    it("Allows users to unstake from multiple pools", async () => {
    });

    it("Allows users to stake in a pool with a different staking token", async () => {
    });

    it("Allows users to claim rewards from a pool with a different staking token", async () => {
    });

    it("Allows users to unstake from a pool with a different staking token", async () => {
    });

    it("Allows users to stake in a pool with a different rewards token", async () => {
    });

    it("Allows users to claim rewards from a pool with a different rewards token", async () => {
    });

    it("Allows users to unstake from a pool with a different rewards token", async () => {
    });

    // all multiple pools tests, multiple users
    it("Allows multiple users to stake in multiple pools", async () => {
    }); // claim, unstake in multiple pools from multiple users
    // allow transferrance of SNFT

    it("Fails when you try to stake for a pool thats not setup by the admin", async () => {
      const config = {
        stakingToken : await mockERC721.getAddress(),
        rewardsToken : await mockERC20.getAddress(),
        rewardsPerBlock : hre.ethers.parseEther("1").toString(),
        // Difference in rewardsPerBlock will create new stakingId
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
        stakingToken : await mockERC721.getAddress(),
        rewardsToken : await mockERC20.getAddress(),
        rewardsPerBlock : hre.ethers.parseEther("2").toString(),
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
        stakingToken : await mockERC721.getAddress(),
        rewardsToken : await mockERC20.getAddress(),
        rewardsPerBlock : hre.ethers.parseEther("3").toString(),
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
        stakingToken : await mockERC721.getAddress(),
        rewardsToken : await mockERC20.getAddress(),
        rewardsPerBlock : hre.ethers.parseEther("50").toString(),
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

    // fails to stake when an NFT is not owned by the user
    // fails to claim when a SNFT is not owned by the user
    // fails to unstake when a SNFT is not owned by the user
    // fails to stake when not setup by admin
    // appropriate fails for when not admin (cannot setConfig or update existing configs)
    // gas tests
  });
});