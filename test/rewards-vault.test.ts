import { expect } from "chai";
import { MockERC20, ZeroRewardsVault } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree/dist/standard";
import { ethers } from "hardhat";


describe.only("ZeroRewardsVault",  () => {
  let rewardsVault : ZeroRewardsVault;
  let token : MockERC20;
  let owner : SignerWithAddress;
  let user1 : SignerWithAddress;
  let user2 : SignerWithAddress;

  // Merkle data
  let tree : StandardMerkleTree<any>;
  let claims : {
    [addr : string] : {
      amount : bigint;
      proof : Array<string>;
    };
  };

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    // Mock token deployment
    const tokenFactory = await ethers.getContractFactory("MockERC20", owner);
    token = await tokenFactory.deploy("Mock Token", "MTK");
    await token.waitForDeployment();

    // Create a Merkle tree
    const claimData = [
      [user1.address, ethers.parseEther("10")],
      [user2.address, ethers.parseEther("20")],
    ];

    tree = StandardMerkleTree.of(claimData, ["address", "uint256"]);

    claims = {};
    for (const [index, [address, amount]] of tree.entries()) {
      claims[address.toLowerCase()] = {
        amount: BigInt(amount),
        proof: tree.getProof(index),
      };
    }

    const RewardsVaultFactory = (await ethers.getContractFactory(
      "ZeroRewardsVault",
      owner
    ));

    rewardsVault = await RewardsVaultFactory.deploy(
      tree.root,
      await token.getAddress()
    );
    await rewardsVault.waitForDeployment();
  });

  it("allows user1 to claim with valid proof", async () => {
    const {
      amount,
      proof,
    } = claims[user1.address.toLowerCase()];

    await rewardsVault.connect(user1).claim(amount, proof);
    await expect(
      25n
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
});