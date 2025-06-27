import { expect } from "chai";
import {
  MockERC20,
  ZeroRewardsVault,
} from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree/dist/standard";
import { ethers } from "hardhat";
import { Claims, getClaimsAndTree } from "./helpers/merkle-rewards";
import {
  INVALID_MERKLE_PROOF_ERR,
  NOT_AUTHORIZED_ERR,
  OWNABLE_UNAUTHORIZED_ERR,
} from "./helpers/errors";


describe.only("ZeroRewardsVault",  () => {
  let rewardsVault : ZeroRewardsVault;
  let token : MockERC20;
  let owner : SignerWithAddress;
  let user1 : SignerWithAddress;
  let user2 : SignerWithAddress;
  let user3 : SignerWithAddress;
  let user4 : SignerWithAddress;

  // Merkle data
  let tree : StandardMerkleTree<[string, bigint]>;
  let claimData : Array<[string, bigint]>;
  let claims : Claims;

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
    ({ claims, merkleTree: tree } = res);

    const RewardsVaultFactory = await ethers.getContractFactory(
      "ZeroRewardsVault",
      owner
    );

    rewardsVault = await RewardsVaultFactory.deploy(
      owner.address,
      token.target
    );
    await rewardsVault.waitForDeployment();

    // Set the Merkle root in the rewards vault
    await rewardsVault.setMerkleRoot(tree.root);

    // Fund the rewards vault with tokens
    await token.mint(rewardsVault.target, ethers.parseEther("1000000"));
  });

  describe("Rewards claim scenarios", () => {
    it("should allow user1 to claim with valid proof", async () => {
      const {
        totalCumulativeRewards,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(
          totalCumulativeRewards,
          proof
        )
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [totalCumulativeRewards, -totalCumulativeRewards]
      );
    });

    it("should fail for invalid proof (user1 tries user2's proof)", async () => {
      const {
        totalCumulativeRewards,
        proof,
      } = claims[user2.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(totalCumulativeRewards, proof)
      ).to.be.revertedWithCustomError(
        rewardsVault,
        INVALID_MERKLE_PROOF_ERR
      ).withArgs(proof);
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
          newClaimData[0][1], // user3's new totalCumulativeRewards
          tree.getProof(0) // user3's new proof
        )
      ).to.changeTokenBalances(
        token,
        [user3, rewardsVault],
        [newClaimData[0][1], -newClaimData[0][1]]
      );
    });

    it("should allow the same user to receive new rewards and claim them while the root is changing", async () => {
      let {
        totalCumulativeRewards,
        proof,
      } = claims[user1.address.toLowerCase()];

      // User1 claims rewards
      await expect(
        rewardsVault.connect(user1).claim(totalCumulativeRewards, proof)
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [totalCumulativeRewards, -totalCumulativeRewards]
      );

      // Now set a new Merkle
      const newRewardsAmount = ethers.parseEther("30");
      const newClaimData : Array<[string, bigint]> = [
        [
          user1.address,
          totalCumulativeRewards + newRewardsAmount,
        ],
      ];

      const res = getClaimsAndTree(newClaimData);
      ({ claims, merkleTree: tree } = res);

      ({
        totalCumulativeRewards,
        proof,
      } = claims[user1.address.toLowerCase()]);

      await rewardsVault.setMerkleRoot(tree.root);

      // User1 can now claim rewards again with the new root
      await expect(
        rewardsVault.connect(user1).claim(
          totalCumulativeRewards,
          proof
        )
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [newRewardsAmount, -newRewardsAmount]
      );
    });

    it("should do multiple root updates and claims in the same test", async () => {
      const totalCumulativeRewards = ethers.parseEther("10");
      const newClaimData1 : Array<[string, bigint]> = [
        [user1.address, totalCumulativeRewards],
        [user2.address, totalCumulativeRewards],
      ];
      const res1 = getClaimsAndTree(newClaimData1);
      ({ claims, merkleTree: tree } = res1);

      await rewardsVault.setMerkleRoot(tree.root);
      await expect(
        rewardsVault.connect(user1).claim(
          claims[user1.address.toLowerCase()].totalCumulativeRewards,
          claims[user1.address.toLowerCase()].proof
        )
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [
          claims[user1.address.toLowerCase()].totalCumulativeRewards,
          -claims[user1.address.toLowerCase()].totalCumulativeRewards,
        ]
      );

      const newClaimData2 : Array<[string, bigint]> = [
        [user1.address, totalCumulativeRewards + ethers.parseEther("15")],
        [user2.address, totalCumulativeRewards + ethers.parseEther("20")],
        [user3.address, totalCumulativeRewards + ethers.parseEther("25")],
      ];
      const res2 = getClaimsAndTree(newClaimData2);
      ({ claims, merkleTree: tree } = res2);

      await rewardsVault.setMerkleRoot(tree.root);

      await expect(
        rewardsVault.connect(user2).claim(
          claims[user2.address.toLowerCase()].totalCumulativeRewards,
          claims[user2.address.toLowerCase()].proof
        )
      ).to.changeTokenBalances(
        token,
        [user2, rewardsVault],
        [
          claims[user2.address.toLowerCase()].totalCumulativeRewards,
          -claims[user2.address.toLowerCase()].totalCumulativeRewards,
        ]
      );

      await expect(
        rewardsVault.connect(user3).claim(
          claims[user3.address.toLowerCase()].totalCumulativeRewards,
          claims[user3.address.toLowerCase()].proof
        )
      ).to.changeTokenBalances(
        token,
        [user3, rewardsVault],
        [
          claims[user3.address.toLowerCase()].totalCumulativeRewards,
          -claims[user3.address.toLowerCase()].totalCumulativeRewards,
        ]
      );
    });

    it("should allow multiple users to claim their rewards", async () => {
      const user1Claim = claims[user1.address.toLowerCase()];
      const user2Claim = claims[user2.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(
          user1Claim.totalCumulativeRewards,
          user1Claim.proof
        )
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [user1Claim.totalCumulativeRewards, -user1Claim.totalCumulativeRewards]
      );

      await expect(
        rewardsVault.connect(user2).claim(
          user2Claim.totalCumulativeRewards,
          user2Claim.proof
        )
      ).to.changeTokenBalances(
        token,
        [user2, rewardsVault],
        [user2Claim.totalCumulativeRewards, -user2Claim.totalCumulativeRewards]
      );
    });

    it("should properly change the totalClaimed state variable after claims", async () => {
      const user1Claim = claims[user1.address.toLowerCase()];
      const user2Claim = claims[user2.address.toLowerCase()];

      const initialTotalClaimed = await rewardsVault.totalClaimed();

      await rewardsVault.connect(user1).claim(
        user1Claim.totalCumulativeRewards,
        user1Claim.proof
      );

      expect(await rewardsVault.totalClaimed()).to.equal(
        initialTotalClaimed + user1Claim.totalCumulativeRewards
      );

      await rewardsVault.connect(user2).claim(
        user2Claim.totalCumulativeRewards,
        user2Claim.proof
      );

      expect(await rewardsVault.totalClaimed()).to.equal(
        initialTotalClaimed + user1Claim.totalCumulativeRewards + user2Claim.totalCumulativeRewards
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
      const localProof = tree.getProof(0);

      await expect(
        rewardsVault.connect(user4).claim(
          ethers.parseEther("10"),
          localProof // user1's proof, but user4 is trying to claim
        )
      ).to.be.revertedWithCustomError(
        rewardsVault,
        INVALID_MERKLE_PROOF_ERR
      ).withArgs(localProof);
    });

    it("should revert if trying to claim more than the allocated totalCumulativeRewards", async () => {
      const {
        totalCumulativeRewards,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(totalCumulativeRewards + 1n, proof)
      ).to.be.revertedWithCustomError(
        rewardsVault,
        INVALID_MERKLE_PROOF_ERR
      ).withArgs(proof);
    });

    it("should revert if trying to claim after the Merkle root has been changed", async () => {
      // the same user, different totalCumulativeRewards
      const newClaimData : Array<[string, bigint]> = [
        [user1.address, ethers.parseEther("5")],
      ];

      const res = getClaimsAndTree(newClaimData);
      // leave old claims intact
      tree = res.merkleTree;

      await rewardsVault.setMerkleRoot(tree.root);

      const {
        totalCumulativeRewards,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(totalCumulativeRewards, proof)
      ).to.be.revertedWithCustomError(
        rewardsVault,
        INVALID_MERKLE_PROOF_ERR
      ).withArgs(proof);
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
        NOT_AUTHORIZED_ERR
      ).withArgs(user1.address);
    });

    it("should revert with NoRewardsToClaim when trying to claim with zero rewards", async () => {
      const zeroClaimData : Array<[string, bigint]> = [
        [user1.address, 0n],
      ];

      const res = getClaimsAndTree(zeroClaimData);
      ({ claims, merkleTree: tree } = res);

      await rewardsVault.setMerkleRoot(tree.root);

      const {
        totalCumulativeRewards,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(totalCumulativeRewards, proof)
      ).to.be.revertedWithCustomError(
        rewardsVault,
        "NoRewardsToClaim"
      ).withArgs(user1.address);
    });
  });

  describe("Pause", () => {
    it("should allow the owner to PAUSE the contract", async () => {
      await rewardsVault.pause();
      expect(await rewardsVault.paused()).to.be.true;

      await expect(
        rewardsVault.connect(user1).claim(
          claims[user1.address.toLowerCase()].totalCumulativeRewards,
          claims[user1.address.toLowerCase()].proof
        )
      ).to.be.revertedWithCustomError(
        rewardsVault,
        "EnforcedPause"
      );
    });

    it("should allow the owner to UNPAUSE the contract", async () => {
      await rewardsVault.pause();
      expect(await rewardsVault.paused()).to.be.true;

      await rewardsVault.unpause();
      expect(await rewardsVault.paused()).to.be.false;

      await expect(
        rewardsVault.connect(user1).claim(
          claims[user1.address.toLowerCase()].totalCumulativeRewards,
          claims[user1.address.toLowerCase()].proof
        )
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [
          claims[user1.address.toLowerCase()].totalCumulativeRewards,
          -claims[user1.address.toLowerCase()].totalCumulativeRewards,
        ]
      );
    });

    it("should not allow non-owners to PAUSE the contract", async () => {
      await expect(
        rewardsVault.connect(user1).pause()
      ).to.be.revertedWithCustomError(
        rewardsVault,
        NOT_AUTHORIZED_ERR
      ).withArgs(user1.address);
    });

    it("should not allow non-owners to UNPAUSE the contract", async () => {
      await expect(
        rewardsVault.connect(user1).unpause()
      ).to.be.revertedWithCustomError(
        rewardsVault,
        NOT_AUTHORIZED_ERR
      ).withArgs(user1.address);
    });

    it("should let operators pause the contract", async () => {
      await rewardsVault.addOperator(user1.address);
      expect(await rewardsVault.isOperator(user1.address)).to.be.true;

      await rewardsVault.connect(user1).pause();
      expect(await rewardsVault.paused()).to.be.true;
    });

    it("should let operators unpause the contract", async () => {
      await rewardsVault.addOperator(user1.address);
      expect(await rewardsVault.isOperator(user1.address)).to.be.true;

      await rewardsVault.connect(user1).pause();
      expect(await rewardsVault.paused()).to.be.true;

      await rewardsVault.connect(user1).unpause();
      expect(await rewardsVault.paused()).to.be.false;
    });

    it("should not allow operators to pause the contract if they are removed", async () => {
      await rewardsVault.addOperator(user1.address);
      expect(await rewardsVault.isOperator(user1.address)).to.be.true;

      await rewardsVault.connect(user1).pause();
      expect(await rewardsVault.paused()).to.be.true;

      await rewardsVault.removeOperator(user1.address);
      expect(await rewardsVault.isOperator(user1.address)).to.be.false;

      await expect(
        rewardsVault.connect(user1).unpause()
      ).to.be.revertedWithCustomError(
        rewardsVault,
        NOT_AUTHORIZED_ERR
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
        OWNABLE_UNAUTHORIZED_ERR
      ).withArgs(user2.address);
    });

    it("should allow the new owner to set a new Merkle root", async () => {
      await rewardsVault.transferOwnership(user1.address);
      const newClaimData : Array<[string, bigint]> = [
        [user1.address, ethers.parseEther("10")],
      ];

      const res = getClaimsAndTree(newClaimData);
      ({ claims, merkleTree: tree } = res);

      await rewardsVault.connect(user1).setMerkleRoot(tree.root);

      const {
        totalCumulativeRewards,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(totalCumulativeRewards, proof)
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [totalCumulativeRewards, -totalCumulativeRewards]
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
      ({ claims, merkleTree: tree } = res);

      await expect(
        rewardsVault.connect(owner).setMerkleRoot(tree.root)
      ).to.be.revertedWithCustomError(
        rewardsVault,
        NOT_AUTHORIZED_ERR
      ).withArgs(owner.address);
    });

    it("should set new operators for the contract and let them correct #setMerkleRoot", async () => {
      await rewardsVault.addOperator(user1.address);
      expect(await rewardsVault.isOperator(user1.address)).to.be.true;

      // User1 can now set a new Merkle root
      const newClaimData : Array<[string, bigint]> = [
        [user1.address, ethers.parseEther("10")],
      ];

      const res = getClaimsAndTree(newClaimData);
      ({ claims, merkleTree: tree } = res);

      await rewardsVault.connect(user1).setMerkleRoot(tree.root);

      const {
        totalCumulativeRewards,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(totalCumulativeRewards, proof)
      ).to.changeTokenBalances(
        token,
        [user1, rewardsVault],
        [totalCumulativeRewards, -totalCumulativeRewards]
      );
    });

    it("should sucsessfully remove an operator and don't let execute #setMerkleRoot", async () => {
      await rewardsVault.addOperator(user1.address);
      expect(await rewardsVault.isOperator(user1.address)).to.be.true;

      await rewardsVault.removeOperator(user1.address);
      expect(await rewardsVault.isOperator(user1.address)).to.be.false;

      await expect(
        rewardsVault.connect(user1).setMerkleRoot(tree.root)
      ).to.be.revertedWithCustomError(
        rewardsVault,
        NOT_AUTHORIZED_ERR
      ).withArgs(user1.address);
    });
  });

  describe("Events", () => {
    it("should emit Claim event on successful claim", async () => {
      const {
        totalCumulativeRewards,
        proof,
      } = claims[user1.address.toLowerCase()];

      await expect(
        rewardsVault.connect(user1).claim(totalCumulativeRewards, proof)
      ).to.emit(rewardsVault, "Claimed")
        .withArgs(user1.address, totalCumulativeRewards, proof);
    });

    it("should emit MerkleRootUpdated event on Merkle root update", async () => {
      const newClaimData : Array<[string, bigint]> = [
        [user1.address, ethers.parseEther("10")],
      ];

      const res = getClaimsAndTree(newClaimData);
      tree = res.merkleTree;

      await expect(
        rewardsVault.setMerkleRoot(tree.root)
      ).to.emit(rewardsVault, "MerkleRootUpdated")
        .withArgs(tree.root);
    });
  });
});