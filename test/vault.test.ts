import * as hre from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { setBalance, time } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

import {
  Vault,
  Vault__factory,
  MockERC20,
  MockERC20__factory,
} from "../typechain";
import { ALREADY_CLAIMED_ERR, INSUFFICIENT_BALANCE_ERR, INVALID_PROOF_ERR } from "./helpers/errors";

describe("Staking Migration Vault", () => {
  let mockWild: MockERC20;
  let mockLp: MockERC20;
  let vaultContract: Vault;

  let owner: SignerWithAddress;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;
  let userC: SignerWithAddress;
  let notStakedUser: SignerWithAddress;

  let values: [string, bigint, bigint][];
  let merkleTree: StandardMerkleTree<any>;

  before(async () => {
    [owner, userA, userB, userC, notStakedUser] = await hre.ethers.getSigners();

    // TODO use ZDC instead for deployment
    const mockWildFactory = new MockERC20__factory(owner);
    mockWild = await mockWildFactory.deploy("Wild", "WILD");

    const mockLpFactory = new MockERC20__factory(owner);
    mockLp = await mockLpFactory.deploy("LP", "LP");

    // Create mock data
    values = [
      [userA.address, 100n, 100n],
      [userB.address, 200n, 0n],
      [userC.address, 0n, 0n],
    ];

    merkleTree = StandardMerkleTree.of(values, ["address", "uint256", "uint256"]);

    const vaultFactory = new Vault__factory(owner);
    vaultContract = await vaultFactory.deploy(
      owner.address,
      merkleTree.root,
      await mockWild.getAddress(),
      await mockLp.getAddress(),
    );
  });

  describe("#constructor", () => {
    // validate incoming data
  });

  describe("setMerkleRoot", () => {
    // it("", async () => {
    // allows owner to set merkle root
    // fails when not owner calls
    // other failures? validation checks?
    // });
  });

  describe("#withdraw", () => {
    // passes when owner calls
    // fails when non-owner calls
    // fails when no balance to transfer
  });

  describe("#claim", () => {
    it("Fails when contract does not have balance to pay claim", async () => {
      const leaf = values[0];
      const proof = merkleTree.getProof(leaf);

      try {
        await vaultContract.connect(userA).claim(proof, leaf[1], leaf[2])
      } catch (e) {
        expect((e as Error).message).to.include(INSUFFICIENT_BALANCE_ERR);
      }
    });

    it("Allows a valid user to claim", async () => {
      const leaf = values[0];
      const proof = merkleTree.getProof(leaf);

      // Now we fund the vault with tokens to give to claimants
      await mockWild.mint(await vaultContract.getAddress(), hre.ethers.parseEther("1000"));
      await mockLp.mint(await vaultContract.getAddress(), hre.ethers.parseEther("1000"));

      const wildBalanceBefore = await mockWild.balanceOf(userA.address);
      const lpBalanceBefore = await mockLp.balanceOf(userA.address);

      // Claim
      await vaultContract.connect(userA).claim(proof, leaf[1], leaf[2]);

      const wildBalanceAfter = await mockWild.balanceOf(userA.address);
      const lpBalanceAfter = await mockLp.balanceOf(userA.address);

      // Balance changes reflect the amount the user was owed
      expect(wildBalanceAfter).to.equal(wildBalanceBefore + (leaf[1]));
      expect(lpBalanceAfter).to.equal(lpBalanceBefore + (leaf[2]));
    });

    it("Only transfers when necessary", async () => {
      const leaf = values[1];
      const proof = merkleTree.getProof(leaf);

      const wildBalanceBefore = await mockWild.balanceOf(userB.address);
      const lpBalanceBefore = await mockLp.balanceOf(userB.address);

      // Claim
      await vaultContract.connect(userB).claim(proof, leaf[1], leaf[2]);

      const wildBalanceAfter = await mockWild.balanceOf(userB.address);
      const lpBalanceAfter = await mockLp.balanceOf(userB.address);

      // Balance changes reflect the amount the user was owed
      // Because amount was non-0, the balance will have changed
      expect(wildBalanceAfter).to.be.gt(wildBalanceBefore);
      expect(wildBalanceAfter).to.equal(wildBalanceBefore + leaf[1]);

      // Because the amount is 0, they are the same
      expect(lpBalanceAfter).to.equal(lpBalanceBefore);
      expect(lpBalanceAfter).to.equal(lpBalanceBefore + leaf[2]);
    });

    it("Fails when user not in merkle tree tries to claim", async () => {
      const leaf = values[0];
      const proof = merkleTree.getProof(leaf);

      // Call with valid data but from a user not in the tree
      await expect(
        vaultContract.connect(notStakedUser).claim(proof, leaf[1], leaf[2])
      ).to.be.revertedWithCustomError(vaultContract, INVALID_PROOF_ERR);
    });

    it("Fails when user already claimed tries to claim again", async () => {
      const leaf = values[0];
      const proof = merkleTree.getProof(leaf);

      // Call again
      await expect(
        vaultContract.connect(userA).claim(proof, leaf[1], leaf[2])
      ).to.be.revertedWithCustomError(vaultContract, ALREADY_CLAIMED_ERR);
    });

    it("Fails when wrong merkle proof is used", async () => {
      const leaf = values[2];
      const proof = merkleTree.getProof(values[1]);

      // Call with wrong proof
      await expect(
        vaultContract.connect(userC).claim(proof, leaf[1], leaf[2])
      ).to.be.revertedWithCustomError(vaultContract, INVALID_PROOF_ERR);
    });

    it("Doesn't send any transfers for a user who is owed nothing", async () => {
      // TODO avoid empty transfers and consider reverting instead in this case
      const leaf = values[2];
      const proof = merkleTree.getProof(leaf);

      const wildBalanceBefore = await mockWild.balanceOf(userC.address);
      const lpBalanceBefore = await mockLp.balanceOf(userC.address);

      // Claim
      await vaultContract.connect(userC).claim(proof, leaf[1], leaf[2]);

      const wildBalanceAfter = await mockWild.balanceOf(userC.address);
      const lpBalanceAfter = await mockLp.balanceOf(userC.address);

      // No balance changes happened
      expect(wildBalanceAfter).to.equal(wildBalanceBefore);
      expect(lpBalanceAfter).to.equal(lpBalanceBefore);
    });
  });
});