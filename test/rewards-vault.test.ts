import { expect } from "chai";
import { MockERC20, ZeroRewardsVault } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree/dist/standard";
import { ethers } from "hardhat";
import { getClaimsAndTree } from "./helpers/merkle-rewards";


describe.only("ZeroRewardsVault",  () => {
  let rewardsVault : ZeroRewardsVault;
  let token : MockERC20;
  let owner : SignerWithAddress;
  let user1 : SignerWithAddress;
  let user2 : SignerWithAddress;
  let user3 : SignerWithAddress;
  let user4 : SignerWithAddress;

  // Merkle data
  let tree : StandardMerkleTree<any>;
  let claimData : Array<[string, bigint]>;
  let claims : {
    [addr : string] : {
      amount : bigint;
      proof : Array<string>;
    };
  };

  describe("Main flows", () => {
    beforeEach(async () => {
      [owner, user1, user2, user3, user4] = await ethers.getSigners();

      // Mock token deployment
      const tokenFactory = await ethers.getContractFactory("MockERC20", owner);
      token = await tokenFactory.deploy("Mock Token", "MTK");
      await token.waitForDeployment();

      // Create a Merkle tree
      claimData = [
        [user1.address, ethers.parseEther("10")],
        [user2.address, ethers.parseEther("20")],
      ];

      const res = getClaimsAndTree(claimData);
      claims = res.claims;
      tree = res.merkleTree;

      const RewardsVaultFactory = (await ethers.getContractFactory(
        "ZeroRewardsVault",
        owner
      ));

      rewardsVault = await RewardsVaultFactory.deploy(
        owner.address,
        token.target
      );
      await rewardsVault.waitForDeployment();

      // Set the Merkle root in the rewards vault
      await rewardsVault.setMerkleRoot(tree.root);

      // Fund the rewards vault with tokens
      await token.mint(rewardsVault.target, ethers.parseEther("1000000"));
      await token.waitForDeployment();
    });

    it("allows user1 to claim with valid proof", async () => {
      const {
        amount,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(
          amount,
          proof
        )
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [amount, -amount]
      );
    });

    it("fails for invalid proof (user1 tries user2's proof)", async () => {
      const {
        amount,
        proof,
      } = claims[user2.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(amount, proof)
      ).to.be.revertedWith("Zero Rewards Vault: Invalid proof");
    });

    it("should allow the owner to set a new Merkle root and properly claim with it", async () => {
      const newClaimData : Array<[string, bigint]> = [
        [user3.address, ethers.parseEther("15")],
        [user4.address, ethers.parseEther("25")],
      ];

      const res = getClaimsAndTree(newClaimData);
      tree = res.merkleTree;

      await rewardsVault.setMerkleRoot(tree.root);

      await expect(
        rewardsVault.connect(user3).claim(
          newClaimData[0][1], // user3's new amount
          tree.getProof(0) // user3's new proof
        )
      ).to.changeTokenBalances(
        token,
        [user3, rewardsVault],
        [newClaimData[0][1], -newClaimData[0][1]]
      );
    });
  });

  describe("Unit tests", () => {
    it("should have the correct owner", async () => {
      expect(await rewardsVault.owner()).to.equal(owner.address);
    });

    it("should return the correct token address", async () => {
      expect(await rewardsVault.token()).to.equal(token.target);
    });

    it("should revert if trying to claim with a proof for the another address", async () => {
      await expect(
        rewardsVault.connect(user4).claim(
          ethers.parseEther("10"),
          tree.getProof(0)  // user1's proof, but user4 is trying to claim
        )
      ).to.be.revertedWith("Zero Rewards Vault: Invalid proof");
    });

    it("should revert if trying to claim more than the allocated amount", async () => {
      const {
        amount,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(amount + 1n, proof)
      ).to.be.revertedWith("Zero Rewards Vault: Invalid proof");
    });

    it("should revert if trying to claim after the Merkle root has been changed", async () => {
      // the same user, different amount
      const newClaimData : Array<[string, bigint]> = [
        [user1.address, ethers.parseEther("5")],
      ];

      const res = getClaimsAndTree(newClaimData);
      // leave old claims intact
      tree = res.merkleTree;

      await rewardsVault.setMerkleRoot(tree.root);

      const {
        amount,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(amount, proof)
      ).to.be.revertedWith("Zero Rewards Vault: Invalid proof");
    });

    it("should not allow setting a new Merkle root by non-owners", async () => {
      const newClaimData = [
        [user1.address, ethers.parseEther("10")],
      ];

      const newTree = StandardMerkleTree.of(newClaimData, ["address", "uint256"]);

      await expect(
        rewardsVault.connect(user1).setMerkleRoot(newTree.root)
      ).to.be.revertedWithCustomError(
        rewardsVault,
        "OwnableUnauthorizedAccount"
      ).withArgs(user1.address);
    });
  });

  describe("Pause", () => {
    it("should allow the owner to PAUSE the contract", async () => {
      await rewardsVault.pause();
      expect(await rewardsVault.paused()).to.be.true;

      await expect(
        rewardsVault.connect(user1).claim(
          claims[user1.address.toLowerCase()].amount,
          claims[user1.address.toLowerCase()].proof
        )
      ).to.be.revertedWithCustomError(
        rewardsVault,
        "EnforcedPause"
      );
    });

    it("should allow the owner to UNPAUSE the contract", async () => {
      await rewardsVault.unpause();
      expect(await rewardsVault.paused()).to.be.false;
    });

    it("should not allow non-owners to PAUSE the contract", async () => {
      await expect(
        rewardsVault.connect(user1).pause()
      ).to.be.revertedWithCustomError(
        rewardsVault,
        "OwnableUnauthorizedAccount"
      ).withArgs(user1.address);
    });

    it("should not allow non-owners to UNPAUSE the contract", async () => {
      await expect(
        rewardsVault.connect(user1).unpause()
      ).to.be.revertedWithCustomError(
        rewardsVault,
        "OwnableUnauthorizedAccount"
      ).withArgs(user1.address);
    });
  });

  describe("Ownership", () => {
    it("should allow the owner to transfer ownership", async () => {
      await rewardsVault.transferOwnership(user1.address);
      expect(await rewardsVault.owner()).to.equal(user1.address);

      // give it back to the owner for further tests
      await rewardsVault.connect(user1).transferOwnership(owner.address);
    });

    it("should not allow non-owners to transfer ownership", async () => {
      await expect(
        rewardsVault.connect(user2).transferOwnership(user3.address)
      ).to.be.revertedWithCustomError(
        rewardsVault,
        "OwnableUnauthorizedAccount"
      ).withArgs(user2.address);
    });

    it("should allow the new owner to set a new Merkle root", async () => {
      await rewardsVault.transferOwnership(user1.address);
      const newClaimData : Array<[string, bigint]> = [
        [user1.address, ethers.parseEther("10")],
      ];

      const res = getClaimsAndTree(newClaimData);
      tree = res.merkleTree;
      claims = res.claims;

      await rewardsVault.connect(user1).setMerkleRoot(tree.root);

      const {
        amount,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(amount, proof)
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [amount, -amount]
      );

      // give it back to the owner for further tests
      await rewardsVault.connect(user1).transferOwnership(owner.address);
    });

    it("should not allow the previous owner to set a new Merkle root after ownership transfer", async () => {
      await rewardsVault.transferOwnership(user1.address);

      const newClaimData : Array<[string, bigint]> = [
        [user2.address, ethers.parseEther("20")],
      ];

      const res = getClaimsAndTree(newClaimData);
      tree = res.merkleTree;
      claims = res.claims;

      await expect(
        rewardsVault.connect(owner).setMerkleRoot(tree.root)
      ).to.be.revertedWithCustomError(
        rewardsVault,
        "OwnableUnauthorizedAccount"
      ).withArgs(owner.address);
    });
  });
});