import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import {
  MigrationClaim,
  MigrationClaim__factory,
  MockERC20,
  MockERC20__factory,
} from "../typechain";
import {
  ALREADY_CLAIMED_ERR,
  CLAIM_PHASE_ERR,
  INSUFFICIENT_ALLOWANCE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  INVALID_PROOF_ERR,
  NO_ZERO_VARIABLES_ERR,
  OWNABLE_INVALID_OWNER_ERR,
  OWNABLE_UNAUTHORIZED_ERR,
  ZERO_VALUE_ERR,
} from "./helpers/errors";
import {
  CLAIMED_EVENT,
  MERKLE_ROOT_SET_EVENT,
} from "./helpers/constants";
import { getMigrationClaimDeployConfig } from "../src/deploy/missions/migration-claim/migration-claim.config";
import { MigrationClaimDM } from "../src/deploy/missions/migration-claim/migration-claim.mission";
import { IZModulesConfig, IZModulesContracts, runZModulesCampaign } from "../src/deploy";
import { DeployCampaign } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";


describe("Staking Migration Claim Tests", () => {
  let mockWild : MockERC20;
  let mockLp : MockERC20;
  let migrationClaim : MigrationClaim;

  let owner : SignerWithAddress;
  let rewardsVault : SignerWithAddress;
  let deployAdmin : SignerWithAddress;
  let userA : SignerWithAddress;
  let userB : SignerWithAddress;
  let userC : SignerWithAddress;
  let notStakedUser : SignerWithAddress;

  interface UserData {
    user : string;
    wildAmount : string;
    lpAmount : string;
  }

  let accountValues : Map<string, UserData>;
  const merkleData : Array<[string, string, string]> = [];
  let merkleTree : StandardMerkleTree<[string, string, string]>;

  let config : IZModulesConfig;

  let campaign : DeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts>;

  // let reset: () => {};

  before(async () => {
    [
      owner,
      deployAdmin,
      rewardsVault,
      userA,
      userB,
      userC,
      notStakedUser,
    ] = await hre.ethers.getSigners();

    const mockWildFactory = new MockERC20__factory(owner);
    mockWild = await mockWildFactory.deploy("Wild", "WILD");

    const mockLpFactory = new MockERC20__factory(owner);
    mockLp = await mockLpFactory.deploy("LP", "LP");

    // Using a map allows indexing using user addresses
    accountValues = new Map<string, UserData>();

    // Set userA
    accountValues.set(
      userA.address,
      {
        user: userA.address,
        wildAmount: hre.ethers.parseEther("100").toString(),
        lpAmount: hre.ethers.parseEther("100").toString(),
      },
    );

    // Set userB
    accountValues.set(
      userB.address,
      {
        user: userB.address,
        wildAmount: hre.ethers.parseEther("150").toString(),
        lpAmount: "0",
      }
    );

    // Set userC
    accountValues.set(
      userC.address,
      {
        user: userC.address,
        wildAmount: "0",
        lpAmount: "0",
      }
    );

    accountValues.forEach(v => {
      merkleData.push([v.user, v.wildAmount, v.lpAmount]);
    });

    merkleTree = StandardMerkleTree.of(merkleData, ["address", "uint256", "uint256"]);

    config = await getMigrationClaimDeployConfig({
      owner,
      deployAdmin,
      merkleRoot: merkleTree.root,
      rewardsVault: rewardsVault.address,
      wildToken: await mockWild.getAddress(),
      lpToken: await mockLp.getAddress(),
    });

    campaign = await runZModulesCampaign({
      config,
      missions: [
        MigrationClaimDM,
      ],
    });

    migrationClaim = campaign.migrationClaim;
  });

  describe("#constructor", () => {
    it("Sets the owner properly", async () => {
      const ownerContract = await migrationClaim.owner();
      expect(ownerContract).to.equal(owner.address);
    });

    it("Allows setting a 0 value for merkle root", async () => {
      const migrationClaimFactory = new MigrationClaim__factory(owner);
      const localMigrationClaim = await migrationClaimFactory.deploy(
        hre.ethers.ZeroHash,
        owner.address,
        rewardsVault.address,
        await mockWild.getAddress(),
        await mockLp.getAddress(),
      );

      expect(await localMigrationClaim.merkleRoot()).to.equal(hre.ethers.ZeroHash);
    });

    it("Fails when owner address is 0", async () => {
      const migrationClaimFactory = new MigrationClaim__factory(owner);
      await expect(
        migrationClaimFactory.deploy(
          merkleTree.root,
          hre.ethers.ZeroAddress,
          rewardsVault.address,
          await mockWild.getAddress(),
          await mockLp.getAddress(),
        )
      ).to.be.revertedWithCustomError(migrationClaim, OWNABLE_INVALID_OWNER_ERR);
    });

    it("Fails when rewards vault address is 0", async () => {
      const migrationClaimFactory = new MigrationClaim__factory(owner);
      await expect(
        migrationClaimFactory.deploy(
          merkleTree.root,
          owner.address,
          hre.ethers.ZeroAddress,
          await mockWild.getAddress(),
          await mockLp.getAddress(),
        )
      ).to.be.revertedWithCustomError(migrationClaim, NO_ZERO_VARIABLES_ERR);
    });

    it("Fails when WILD token address is 0", async () => {
      const migrationClaimFactory = new MigrationClaim__factory(owner);
      await expect(
        migrationClaimFactory.deploy(
          merkleTree.root,
          owner.address,
          rewardsVault.address,
          hre.ethers.ZeroAddress,
          await mockLp.getAddress(),
        )
      ).to.be.revertedWithCustomError(migrationClaim, NO_ZERO_VARIABLES_ERR);
    });

    it("Fails when LP token address is 0", async () => {
      const migrationClaimFactory = new MigrationClaim__factory(owner);
      await expect(
        migrationClaimFactory.deploy(
          merkleTree.root,
          owner.address,
          rewardsVault.address,
          await mockWild.getAddress(),
          hre.ethers.ZeroAddress,
        )
      ).to.be.revertedWithCustomError(migrationClaim, NO_ZERO_VARIABLES_ERR);
    });
  });

  describe("#setMerkleRoot", () => {
    it("Allows the owner to set a new merkle root when `started` is false", async () => {
      // await reset();

      const newMerkleData = merkleData.slice(0, 2);
      const newMerkleTree = StandardMerkleTree.of(newMerkleData, ["address", "uint256", "uint256"]);

      const isStarted = await migrationClaim.started();
      expect(isStarted).to.be.false;

      const factory = new MigrationClaim__factory(deployAdmin);

      const localMigrationClaim = await factory.deploy(
        newMerkleTree.root,
        owner,
        rewardsVault,
        mockWild,
        mockLp
      );

      await expect(
        localMigrationClaim.connect(owner).setMerkleRoot(newMerkleTree.root)
      ).to.emit(localMigrationClaim, MERKLE_ROOT_SET_EVENT).withArgs(newMerkleTree.root);

      expect(await localMigrationClaim.merkleRoot()).to.equal(newMerkleTree.root);
    });

    it("Fails when a non-owner tries to set a new merkle root", async () => {
      const newMerkleData = merkleData.slice(0, 2);
      const newMerkleTree = StandardMerkleTree.of(newMerkleData, ["address", "uint256", "uint256"]);

      await expect(
        migrationClaim.connect(userA).setMerkleRoot(newMerkleTree.root)
      ).to.be.revertedWithCustomError(migrationClaim, OWNABLE_UNAUTHORIZED_ERR);
    });

    it("Fails when setting 0 value as the new merkle root", async () => {
      await expect(
        migrationClaim.connect(owner).setMerkleRoot(hre.ethers.ZeroHash)
      ).to.be.revertedWithCustomError(migrationClaim, NO_ZERO_VARIABLES_ERR);
    });
  });

  describe("#claim", () => {
    it("Fails when the rewards vault has not given allowance to the contract", async () => {
      // await reset();

      const data = (accountValues.get(userA.address))!;

      // console.log(await migrationClaim.merkleRoot());
      // console.log(merkleTree.root)

      const proof = merkleTree.getProof([data.user, data.wildAmount, data.lpAmount]);

      await expect(
        migrationClaim.connect(userA).claim(proof, data.wildAmount , data.lpAmount)
      ).to.be.revertedWithCustomError(mockWild, INSUFFICIENT_ALLOWANCE_ERR)
        .withArgs(await migrationClaim.getAddress(), 0n, data.wildAmount);
    });

    it("Fails when rewards vault does not have balance to pay claim", async () => {
      const data = (accountValues.get(userA.address))!;

      const proof = merkleTree.getProof([data.user, data.wildAmount, data.lpAmount]);

      // Give allowance for WILD transfers
      await mockWild.connect(rewardsVault).approve(
        await migrationClaim.getAddress(),
        hre.ethers.parseEther("1000")
      );

      // Give allowance for LP transfers
      await mockLp.connect(rewardsVault).approve(
        await migrationClaim.getAddress(),
        hre.ethers.parseEther("1000")
      );

      await expect(
        migrationClaim.connect(userA).claim(proof, data.wildAmount, data.lpAmount)
      ).to.be.revertedWithCustomError(mockWild, INSUFFICIENT_BALANCE_ERR)
        .withArgs(rewardsVault.address, 0n, data.wildAmount);
    });

    it("Allows valid claim and sets `started` to true as is first claim, causing `setMerkleRoot` to fail", async () => {
      let isStarted = await migrationClaim.started();
      expect(isStarted).to.be.false;

      const data = (accountValues.get(userA.address))!;
      const proof = merkleTree.getProof([data.user, data.wildAmount, data.lpAmount]);

      // Fund the vault with tokens to give to claimants
      await mockWild.mint(rewardsVault.address, hre.ethers.parseEther("1000"));
      await mockLp.mint(rewardsVault.address, hre.ethers.parseEther("1000"));

      await expect(
        migrationClaim.connect(userA).claim(proof, data.wildAmount, data.lpAmount)
      ).to.emit(migrationClaim, CLAIMED_EVENT).withArgs(userA.address, data.wildAmount, data.lpAmount);

      isStarted = await migrationClaim.started();
      expect(isStarted).to.be.true;

      await expect(
        migrationClaim.connect(owner).setMerkleRoot(hre.ethers.ZeroHash)
      ).to.be.revertedWithCustomError(migrationClaim, CLAIM_PHASE_ERR);
    });

    it("Allows claiming when a user is only owed one of the tokens", async () => {
      const data = (accountValues.get(userB.address))!;
      const proof = merkleTree.getProof([data.user, data.wildAmount, data.lpAmount]);

      const wildBalanceBefore = await mockWild.balanceOf(userB.address);
      const lpBalanceBefore = await mockLp.balanceOf(userB.address);

      // Claim
      await expect(
        migrationClaim.connect(userB).claim(proof, data.wildAmount, data.lpAmount)
      ).to.emit(migrationClaim, CLAIMED_EVENT).withArgs(userB.address, data.wildAmount, data.lpAmount);

      const wildBalanceAfter = await mockWild.balanceOf(userB.address);
      const lpBalanceAfter = await mockLp.balanceOf(userB.address);

      // Because amount was non-0, the balance will have changed
      expect(wildBalanceAfter).to.be.gt(wildBalanceBefore);
      expect(wildBalanceAfter).to.equal(wildBalanceBefore + data.wildAmount);

      // Because the amount is 0, they are the same
      expect(lpBalanceAfter).to.equal(lpBalanceBefore);
      expect(lpBalanceAfter).to.equal(lpBalanceBefore + data.lpAmount);
    });

    it("Fails when user not in merkle tree tries to claim", async () => {
      const data = (accountValues.get(userA.address))!;
      const proof = merkleTree.getProof([data.user, data.wildAmount, data.lpAmount]);

      // Call with valid data but from a user not in the tree
      await expect(
        migrationClaim.connect(notStakedUser).claim(proof, data.wildAmount, data.lpAmount)
      ).to.be.revertedWithCustomError(migrationClaim, INVALID_PROOF_ERR);
    });

    it("Fails when user already claimed tries to claim again", async () => {
      const data = (accountValues.get(userA.address))!;
      const proof = merkleTree.getProof([data.user, data.wildAmount, data.lpAmount]);

      // Call again
      await expect(
        migrationClaim.connect(userA).claim(proof, data.wildAmount, data.lpAmount)
      ).to.be.revertedWithCustomError(migrationClaim, ALREADY_CLAIMED_ERR);
    });

    it("Fails when wrong merkle proof is used", async () => {
      const dataB = (accountValues.get(userB.address))!;
      const dataC = (accountValues.get(userC.address))!;

      const proofB = merkleTree.getProof([dataB.user, dataB.wildAmount, dataB.lpAmount]);

      // Call proof for userB as userC
      await expect(
        migrationClaim.connect(userC).claim(proofB, dataC.wildAmount, dataC.lpAmount)
      ).to.be.revertedWithCustomError(migrationClaim, INVALID_PROOF_ERR);
    });

    it("Fails when wrong amount is used", async () => {
      const data = (accountValues.get(userC.address))!;
      const proof = merkleTree.getProof([data.user, data.wildAmount, data.lpAmount]);


      // Call with wrong amount
      await expect(
        migrationClaim.connect(userC).claim(proof, data.wildAmount + 1n, data.lpAmount + 1n)
      ).to.be.revertedWithCustomError(migrationClaim, INVALID_PROOF_ERR);
    });

    it("Fails when both transfer amounts are 0", async () => {
      const data = (accountValues.get(userC.address))!;
      const proof = merkleTree.getProof([data.user, data.wildAmount, data.lpAmount]);

      // Call with 0 amounts
      await expect(
        migrationClaim.connect(userC).claim(proof, data.wildAmount, data.lpAmount)
      ).to.be.revertedWithCustomError(migrationClaim, ZERO_VALUE_ERR);
    });
  });
});