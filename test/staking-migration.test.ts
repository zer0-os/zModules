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
  INSUFFICIENT_ALLOWANCE_ERR,
  INSUFFICIENT_BALANCE_ERR,
  INVALID_PROOF_ERR,
  NO_ZERO_VARIABLES_ERR,
  OWNABLE_UNAUTHORIZED_ERR,
  ZERO_VALUE_ERR,
} from "./helpers/errors";
import {
  CLAIMED_EVENT,
  MERKLE_ROOT_SET_EVENT,
} from "./helpers/constants";

describe("Staking Migration Claim Tests", () => {
  let mockWild : MockERC20;
  let mockLp : MockERC20;
  let migrationClaim : MigrationClaim;

  let owner : SignerWithAddress;
  let rewardsVault : SignerWithAddress;
  let userA : SignerWithAddress;
  let userB : SignerWithAddress;
  let userC : SignerWithAddress;
  let notStakedUser : SignerWithAddress;

  let merkleData : Array<[string, string, string]>;
  let merkleTree : StandardMerkleTree<[string, string, string]>;

  before(async () => {
    [owner, rewardsVault, userA, userB, userC, notStakedUser] = await hre.ethers.getSigners();

    // TODO use ZDC instead for deployment
    const mockWildFactory = new MockERC20__factory(owner);
    mockWild = await mockWildFactory.deploy("Wild", "WILD");

    const mockLpFactory = new MockERC20__factory(owner);
    mockLp = await mockLpFactory.deploy("LP", "LP");

    // Create mock data
    merkleData = [
      [
        userA.address,
        hre.ethers.parseEther("100").toString(),
        hre.ethers.parseEther("100").toString(),
      ],
      [
        userB.address,
        hre.ethers.parseEther("150").toString(),
        "0",
      ],
      [userC.address, "0", "0"],
    ];

    merkleTree = StandardMerkleTree.of(merkleData, ["address", "uint256", "uint256"]);

    const migrationClaimFactory = new MigrationClaim__factory(owner);
    migrationClaim = await migrationClaimFactory.deploy(
      merkleTree.root,
      owner.address,
      rewardsVault.address,
      await mockWild.getAddress(),
      await mockLp.getAddress(),
    );
  });

  describe("#constructor", () => {
    // validate incoming data
    it("Sets the owner properly", async () => {
      const ownerContract = await migrationClaim.owner();
      expect(ownerContract).to.equal(owner.address);
    });
  });

  describe("#claim", () => {
    it("Fails when the rewards vault has not given allowance to the contract", async () => {
      const [, wildAmount, lpAmount] = merkleData[0];
      const proof = merkleTree.getProof(merkleData[0]);

      await expect(
        migrationClaim.connect(userA).claim(proof, wildAmount, lpAmount)
      ).to.be.revertedWithCustomError(mockWild, INSUFFICIENT_ALLOWANCE_ERR)
        .withArgs(await migrationClaim.getAddress(), 0n, wildAmount);
    });

    it("Fails when rewards vault does not have balance to pay claim", async () => {
      const [, wildAmount, lpAmount] = merkleData[0];
      const proof = merkleTree.getProof(merkleData[0]);

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
        migrationClaim.connect(userA).claim(proof, wildAmount, lpAmount)
      ).to.be.revertedWithCustomError(mockWild, INSUFFICIENT_BALANCE_ERR)
        .withArgs(rewardsVault.address, 0n, wildAmount);
    });

    it("Allows a valid user to claim", async () => {
      const [, wildAmount, lpAmount] = merkleData[0];
      const proof = merkleTree.getProof(merkleData[0]);

      // Now we fund the vault with tokens to give to claimants
      await mockWild.mint(rewardsVault.address, hre.ethers.parseEther("1000"));
      await mockLp.mint(rewardsVault.address, hre.ethers.parseEther("1000"));

      const wildBalanceBefore = await mockWild.balanceOf(userA.address);
      const lpBalanceBefore = await mockLp.balanceOf(userA.address);

      // Claim
      await expect(
        migrationClaim.connect(userA).claim(proof, wildAmount, lpAmount)
      ).to.emit(migrationClaim, CLAIMED_EVENT).withArgs(userA.address, wildAmount, lpAmount);

      const wildBalanceAfter = await mockWild.balanceOf(userA.address);
      const lpBalanceAfter = await mockLp.balanceOf(userA.address);

      // Balance changes reflect the amount the user was owed
      expect(wildBalanceAfter).to.equal(wildBalanceBefore + wildAmount);
      expect(lpBalanceAfter).to.equal(lpBalanceBefore + lpAmount);
    });

    it("Allows claiming when a user is only owed one of the tokens", async () => {
      const [, wildAmount, lpAmount] = merkleData[1];
      const proof = merkleTree.getProof(merkleData[1]);

      const wildBalanceBefore = await mockWild.balanceOf(userB.address);
      const lpBalanceBefore = await mockLp.balanceOf(userB.address);

      // Claim
      await expect(
        migrationClaim.connect(userB).claim(proof, wildAmount, lpAmount)
      ).to.emit(migrationClaim, CLAIMED_EVENT).withArgs(userB.address, wildAmount, lpAmount);

      const wildBalanceAfter = await mockWild.balanceOf(userB.address);
      const lpBalanceAfter = await mockLp.balanceOf(userB.address);

      // Because amount was non-0, the balance will have changed
      expect(wildBalanceAfter).to.be.gt(wildBalanceBefore);
      expect(wildBalanceAfter).to.equal(wildBalanceBefore + wildAmount);

      // Because the amount is 0, they are the same
      expect(lpBalanceAfter).to.equal(lpBalanceBefore);
      expect(lpBalanceAfter).to.equal(lpBalanceBefore + lpAmount);
    });

    it("Fails when user not in merkle tree tries to claim", async () => {
      const [, wildAmount, lpAmount ] =merkleData[0];
      const proof = merkleTree.getProof(merkleData[0]);

      // Call with valid data but from a user not in the tree
      await expect(
        migrationClaim.connect(notStakedUser).claim(proof, wildAmount, lpAmount)
      ).to.be.revertedWithCustomError(migrationClaim, INVALID_PROOF_ERR);
    });

    it("Fails when user already claimed tries to claim again", async () => {
      const [, wildAmount, lpAmount ] =merkleData[0];
      const proof = merkleTree.getProof(merkleData[0]);

      // Call again
      await expect(
        migrationClaim.connect(userA).claim(proof, wildAmount, lpAmount)
      ).to.be.revertedWithCustomError(migrationClaim, ALREADY_CLAIMED_ERR);
    });

    it("Fails when wrong merkle proof is used", async () => {
      const [, wildAmount, lpAmount ] =merkleData[2];
      const proof = merkleTree.getProof(merkleData[1]);

      // Call proof for userB as userC
      await expect(
        migrationClaim.connect(userC).claim(proof, wildAmount, lpAmount)
      ).to.be.revertedWithCustomError(migrationClaim, INVALID_PROOF_ERR);
    });

    it("Fails when wrong amount is used", async () => {
      const [, wildAmount, lpAmount ] =merkleData[2];
      const proof = merkleTree.getProof(merkleData[2]);

      // Call with wrong amount
      await expect(
        migrationClaim.connect(userC).claim(proof, wildAmount + 1n, lpAmount + 1n)
      ).to.be.revertedWithCustomError(migrationClaim, INVALID_PROOF_ERR);
    });

    it("Fails when both transfer amounts are 0", async () => {
      const [, wildAmount, lpAmount ] =merkleData[2];
      const proof = merkleTree.getProof(merkleData[2]);

      // Call with 0 amounts
      await expect(
        migrationClaim.connect(userC).claim(proof, wildAmount, lpAmount)
      ).to.be.revertedWithCustomError(migrationClaim, ZERO_VALUE_ERR);
    });
  });

  describe("#setMerkleRoot", () => {
    it("Allows the owner to set a new merkle root", async () => {
      const newMerkleData = merkleData.slice(0, 2);
      const newMerkleTree = StandardMerkleTree.of(newMerkleData, ["address", "uint256", "uint256"]);

      await expect(
        migrationClaim.connect(owner).setMerkleRoot(newMerkleTree.root)
      ).to.emit(migrationClaim, MERKLE_ROOT_SET_EVENT).withArgs(newMerkleTree.root);

      expect(await migrationClaim.merkleRoot()).to.equal(newMerkleTree.root);
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

  describe("#setRewardsVault", () => {
    it("Allows the owner to set a new rewards vault", async () => {
      const newRewardsVault = userA.address;

      await expect(
        migrationClaim.connect(owner).setRewardsVault(newRewardsVault)
      ).to.emit(migrationClaim, "RewardsVaultSet").withArgs(newRewardsVault);

      expect(await migrationClaim.rewardsVault()).to.equal(newRewardsVault);
    });

    it("Fails when a non-owner tries to set a new rewards vault", async () => {
      await expect(
        migrationClaim.connect(userA).setRewardsVault(userB.address)
      ).to.be.revertedWithCustomError(migrationClaim, OWNABLE_UNAUTHORIZED_ERR);
    });

    it("Fails when setting 0 value as the new rewards vault", async () => {
      await expect(
        migrationClaim.connect(owner).setRewardsVault(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(migrationClaim, NO_ZERO_VARIABLES_ERR);
    });
  });

  describe("#setWildToken", () => {
    it("Allows the owner to set a new WILD token", async () => {
      const newWildToken = userA.address;

      await expect(
        migrationClaim.connect(owner).setWildToken(newWildToken)
      ).to.emit(migrationClaim, "WildTokenSet").withArgs(newWildToken);

      expect(await migrationClaim.wildToken()).to.equal(newWildToken);
    });

    it("Fails when a non-owner tries to set a new WILD token", async () => {
      await expect(
        migrationClaim.connect(userA).setWildToken(userB.address)
      ).to.be.revertedWithCustomError(migrationClaim, OWNABLE_UNAUTHORIZED_ERR);
    });

    it("Fails when setting 0 value as the new WILD token", async () => {
      await expect(
        migrationClaim.connect(owner).setWildToken(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(migrationClaim, NO_ZERO_VARIABLES_ERR);
    });
  });

  describe("#setLpToken", () => {
    it("Allows the owner to set a new LP token", async () => {
      const newLpToken = userA.address;

      await expect(
        migrationClaim.connect(owner).setLpToken(newLpToken)
      ).to.emit(migrationClaim, "LpTokenSet").withArgs(newLpToken);

      expect(await migrationClaim.lpToken()).to.equal(newLpToken);
    });

    it("Fails when a non-owner tries to set a new LP token", async () => {
      await expect(
        migrationClaim.connect(userA).setLpToken(userB.address)
      ).to.be.revertedWithCustomError(migrationClaim, OWNABLE_UNAUTHORIZED_ERR);
    });

    it("Fails when setting 0 value as the new LP token", async () => {
      await expect(
        migrationClaim.connect(owner).setLpToken(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(migrationClaim, NO_ZERO_VARIABLES_ERR);
    });
  });
});