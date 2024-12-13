import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  TimelockController,
  ZDAO,
  ZeroVotingERC20,
  ZeroVotingERC721,
} from "../typechain";
import { expect } from "chai";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { mineBlocks } from "./helpers/voting/mineBlocks";


describe("zDAO Test", () => {
  let admin : SignerWithAddress;
  let user1 : SignerWithAddress;
  let user2 : SignerWithAddress;
  let nonHolder : SignerWithAddress;

  let daoERC20 : ZDAO;
  let daoERC721 : ZDAO;
  let nft : ZeroVotingERC721;
  let erc20 : ZeroVotingERC20;
  let timelock : TimelockController;

  const delay = 1;
  const votingPeriod = 10;
  const proposalThreshold = 2;
  const quorumPercentage = 10;
  const voteExtension = 5;

  before(async () => {
    [admin, user1, user2, nonHolder] = await hre.ethers.getSigners();

    // nft deployment
    const nftFact = await hre.ethers.getContractFactory("ZeroVotingERC721");
    nft = await nftFact.deploy(
      "ZeroVotingNFT",
      "ZVNFT",
      "1.0",
      admin
    );

    // erc20 deployment
    const erc20Fact = await hre.ethers.getContractFactory("ZeroVotingERC20");
    erc20 = await erc20Fact.deploy(
      "ZeroVotingERC20",
      "ZV",
      admin
    );

    // timelock deployment
    const timelockFact = await hre.ethers.getContractFactory("TimelockController");
    timelock = await timelockFact.deploy(1, [], [], admin.address);

    const daoFact = await hre.ethers.getContractFactory("ZDAO");
    daoERC20 = await daoFact.deploy(
      "ZDAO",
      erc20,
      await timelock.getAddress(),
      delay,
      votingPeriod,
      proposalThreshold,
      quorumPercentage,
      voteExtension,
    );

    // mint start balance to token holders
    await erc20.connect(admin).mint(admin.address, hre.ethers.parseUnits("1000"));
    await erc20.connect(admin).mint(user1.address, hre.ethers.parseUnits("100"));
    await erc20.connect(admin).mint(user2.address, hre.ethers.parseUnits("100"));

    // mint 10 nfts to token holders
    for (let i = 0; i < 10; i++) {
      await nft.connect(admin).mint(admin.address, i);
      await nft.connect(admin).mint(user1.address, 10 + i);
      await nft.connect(admin).mint(user2.address, 20 + i);
    }

    // delegate votes
    await erc20.connect(admin).delegate(admin.address);
    await erc20.connect(user1).delegate(user1.address);
    await erc20.connect(user2).delegate(user2.address);

    await nft.connect(admin).delegate(admin.address);
    await nft.connect(user1).delegate(user1.address);
    await nft.connect(user2).delegate(user2.address);
  });

  describe("DAO with ERC20", () => {
    it("Should start voting after the delay", async () => {
      const targets = [erc20];
      const values = [0];
      const calldatas = [
        erc20.interface.encodeFunctionData("mint", [user1.address, 100]),
      ];
      const description = "Mint 100 tokens to user1";
      const descriptionHash = await hre.ethers.keccak256(hre.ethers.toUtf8Bytes(description));

      const proposeTx = await daoERC20.propose(
        targets,
        values,
        calldatas,
        description
      );
      await proposeTx.wait();

      const proposalId = await daoERC20.hashProposal(
        targets,
        values,
        calldatas,
        descriptionHash
      );

      // wait (delay + voteExtension) blocks
      await mineBlocks(delay + voteExtension);

      // 1 = active
      expect(
        await daoERC20.state(proposalId)
      ).to.equal(
        1n
      );
    });

    it("Should track all proposal states correctly (no queue)", async () => {
      const targets = [erc20];
      const values = [0];
      const calldatas = [
        erc20.interface.encodeFunctionData("mint", [user1.address, 10]),
        erc20.interface.encodeFunctionData("mint", [user2.address, 100]),
        erc20.interface.encodeFunctionData("mint", [nonHolder.address, 1]),
      ];
      const description = "Mint 10 tokens to user1";
      const description2 = "Mint 100 tokens to user2";
      const description3 = "Mint 1 token to nonHolder";
      const descriptionHash = await hre.ethers.keccak256(hre.ethers.toUtf8Bytes(description));
      const descriptionHash2 = await hre.ethers.keccak256(hre.ethers.toUtf8Bytes(description2));
      const descriptionHash3 = await hre.ethers.keccak256(hre.ethers.toUtf8Bytes(description3));

      // make defeated proposal
      await daoERC20.propose(
        targets,
        values,
        [calldatas[0]],
        description
      );
      const proposalId = await daoERC20.hashProposal(
        targets,
        values,
        [calldatas[0]],
        descriptionHash
      );

      // success proposal
      await daoERC20.propose(
        targets,
        values,
        [calldatas[1]],
        description2
      );
      const proposalId2 = await daoERC20.hashProposal(
        targets,
        values,
        [calldatas[1]],
        descriptionHash2
      );

      // shouldn't be opened. 0 = Pending
      expect(
        await daoERC20.state(proposalId)
      ).to.equal(
        0n
      );

      // canceled proposal
      await daoERC20.propose(
        targets,
        values,
        [calldatas[2]],
        description3
      );
      const proposalId3 = await daoERC20.hashProposal(
        targets,
        values,
        [calldatas[2]],
        descriptionHash3
      );

      // cancel third proposal
      const tx = await daoERC20.cancel(
        targets,
        values,
        [calldatas[2]],
        descriptionHash3
      );
      await tx.wait();

      await mineBlocks(delay);

      // should be created, but not completed
      expect(
        await daoERC20.state(proposalId)
      ).to.equal(
        1n
      );

      expect(
        await daoERC20.state(proposalId3)
      ).to.equal(
        2n
      );

      // cast votes for 2nd propose
      await daoERC20.connect(user1).castVote(proposalId2, 1);
      await daoERC20.connect(user2).castVote(proposalId2, 1);

      // Advance to end of voting period
      await mineBlocks(delay + voteExtension + 9999);

      // 3 = Defeated state
      expect(
        await daoERC20.state(proposalId)
      ).to.equal(
        3n
      );

      // 4 = Succeeded state for 2nd proposal
      expect(
        await daoERC20.state(proposalId2)
      ).to.equal(
        4n
      );
    });

    it("Should", async () => {});

    it("Should", async () => {});
  });
});
