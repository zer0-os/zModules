import { ethers } from "hardhat";
import { expect } from "chai";
import { mineBlocks } from "./helpers/commonFunctions";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  MockERC20Votes,
  MockERC721Votes,
  TimelockController,
  ZDAO,
} from "../typechain-types";
import { MINTER_ROLE } from "./helpers/constants";


describe.only("Governance Flow Test - Advanced", () => {
  let governance : ZDAO;
  let token : MockERC20Votes;
  let token2 : MockERC721Votes;
  let timelock : TimelockController;

  let owner : HardhatEthersSigner;
  let proposer : HardhatEthersSigner;
  let voter1 : HardhatEthersSigner;
  let voter2 : HardhatEthersSigner;
  let voter3 : HardhatEthersSigner;

  let tokenAddr : string;
  let token2Addr : string;

  before(async () => {
    [
      owner,
      proposer,
      voter1,
      voter2,
      voter3,
    ] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20Votes");
    token = await Token.deploy("Governance Token", "GT", owner);
    await token.waitForDeployment();

    const Token2 = await ethers.getContractFactory("MockERC721Votes");
    token2 = await Token2.deploy("Governance Token 2", "GT2", "1.0", owner);
    await token2.waitForDeployment();

    await token.connect(owner).mint(proposer.address, ethers.parseUnits("1000"));
    await token.connect(owner).mint(owner.address, ethers.parseUnits("1000"));
    await token.connect(owner).mint(voter1.address, ethers.parseUnits("500"));
    await token.connect(owner).mint(voter2.address, ethers.parseUnits("500"));

    await token2.connect(owner).mint(voter2.address, "9");

    await token.connect(proposer).delegate(proposer.address);
    await token.connect(owner).delegate(owner.address);
    await token.connect(voter1).delegate(voter1.address);
    await token.connect(voter2).delegate(voter2.address);

    const proposers = [proposer.address];
    const executors = [proposer.address];

    const TimelockC = await ethers.getContractFactory("TimelockController");
    const minDelay = 1;
    timelock = await TimelockC.deploy(minDelay, proposers, executors, owner.address);
    await timelock.waitForDeployment();

    tokenAddr = await token.getAddress();
    token2Addr = await token2.getAddress();

    const Governance = await ethers.getContractFactory("ZDAO");

    governance = await Governance.deploy(
      "Governance DAO",
      tokenAddr,
      await timelock.getAddress(),
      1n,
      5n,
      1n,
      50n,
      2n
    );
    await governance.waitForDeployment();

    await timelock.connect(owner).grantRole(await timelock.PROPOSER_ROLE(), await governance.getAddress());
    await timelock.connect(owner).grantRole(await timelock.EXECUTOR_ROLE(), await governance.getAddress());

    await token.connect(owner).grantRole(MINTER_ROLE, await timelock.getAddress());
    await token2.connect(owner).grantRole(MINTER_ROLE, await timelock.getAddress());
  });

  describe("ERC20 Voting Tests", () => {
    it("Should use the correct token in governance", async () => {
      expect(
        await governance.token()
      ).to.equal(
        tokenAddr
      );
    });

    it("Should prevent non-token holders from participating in votes", async () => {
      const targets = [tokenAddr];
      const values = [0];
      const calldatas = [
        token.interface.encodeFunctionData("transfer", [voter3.address, 100]),
      ];
      const description = "Proposal #1: Transfer 100 tokens to nonHolder";

      await governance.connect(owner).propose(targets, values, calldatas, description);

      const proposalId = await governance.hashProposal(
        targets,
        values,
        calldatas,
        ethers.keccak256(ethers.toUtf8Bytes(description))
      );

      await expect(
        governance.connect(voter3).castVote(proposalId, 1)
      ).to.be.revertedWith(
        "Governor: non-holder cannot vote"
      );
    });

    it("Should prevent double voting by the same token holder", async () => {});

    it("Many users vote (+ and -)", async () => {
      const mintAmount = ethers.parseUnits("100");
      const targets = [tokenAddr];
      const values = [0];
      const calldatas = [
        token.interface.encodeFunctionData("mint", [proposer.address, mintAmount]),
      ];
      const description = "Mint additional tokens to proposer";

      await governance.connect(proposer).propose(targets, values, calldatas, description);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
      const proposalId = await governance.hashProposal(targets, values, calldatas, descriptionHash);

      await mineBlocks(2);

      await governance.connect(proposer).castVote(proposalId, 1);
      await governance.connect(voter1).castVote(proposalId, 1);
      await governance.connect(voter2).castVote(proposalId, 0);

      await mineBlocks(5);

      const state = await governance.state(proposalId);
      expect(state).to.equal(4);

      await governance.connect(proposer).queue(
        targets,
        values,
        calldatas,
        descriptionHash
      );

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);
      await governance.connect(proposer).execute(targets, values, calldatas, descriptionHash);

      const finalBalance = await token.balanceOf(proposer.address);
      // 1000 was before mint and then mints 100 more.
      expect(finalBalance).to.equal(ethers.parseUnits("1100"));
    });

    it("Other vote, while one propose executes", async () => {
      const proposal1Amount = ethers.parseUnits("50");
      const proposal2Amount = ethers.parseUnits("75");

      const proposal1Targets = [tokenAddr];
      const proposal1Values = [0];
      const proposal1Calldatas = [
        token.interface.encodeFunctionData("mint", [voter1.address, proposal1Amount]),
      ];
      const proposal1Description = "Mint additional tokens to voter1";

      const proposal2Targets = [tokenAddr];
      const proposal2Values = [0];
      const proposal2Calldatas = [
        token.interface.encodeFunctionData("mint", [voter2.address, proposal2Amount]),
      ];
      const proposal2Description = "Mint additional tokens to voter2";

      await governance.connect(proposer).propose(
        proposal1Targets,
        proposal1Values,
        proposal1Calldatas,
        proposal1Description
      );
      await governance.connect(proposer).propose(
        proposal2Targets,
        proposal2Values,
        proposal2Calldatas,
        proposal2Description
      );

      const proposal1DescriptionHash = ethers.keccak256(ethers.toUtf8Bytes(proposal1Description));
      const proposal2DescriptionHash = ethers.keccak256(ethers.toUtf8Bytes(proposal2Description));
      const proposal1Id = await governance.hashProposal(
        proposal1Targets,
        proposal1Values,
        proposal1Calldatas,
        proposal1DescriptionHash
      );
      const proposal2Id = await governance.hashProposal(
        proposal2Targets,
        proposal2Values,
        proposal2Calldatas,
        proposal2DescriptionHash
      );

      await mineBlocks(2);

      await governance.connect(proposer).castVote(proposal1Id, 1);
      await governance.connect(voter1).castVote(proposal1Id, 1);
      await governance.connect(voter2).castVote(proposal1Id, 0);

      await governance.connect(proposer).castVote(proposal2Id, 1);
      await governance.connect(voter1).castVote(proposal2Id, 0);
      await governance.connect(voter2).castVote(proposal2Id, 1);

      await mineBlocks(5);

      expect(await governance.state(proposal1Id)).to.equal(4);
      expect(await governance.state(proposal2Id)).to.equal(4);

      await governance.connect(proposer).queue(
        proposal1Targets,
        proposal1Values,
        proposal1Calldatas,
        proposal1DescriptionHash
      );
      await governance.connect(proposer).queue(
        proposal2Targets,
        proposal2Values,
        proposal2Calldatas,
        proposal2DescriptionHash
      );

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await governance.connect(proposer).execute(
        proposal1Targets,
        proposal1Values,
        proposal1Calldatas,
        proposal1DescriptionHash
      );
      await governance.connect(proposer).execute(
        proposal2Targets,
        proposal2Values,
        proposal2Calldatas,
        proposal2DescriptionHash
      );

      // = start balance - `proposal${n}Amount`
      expect(
        await token.balanceOf(voter1.address)
      ).to.equal(
        ethers.parseUnits("550")
      );

      expect(
        await token.balanceOf(voter2.address)
      ).to.equal(
        ethers.parseUnits("575")
      );
    });
  });

  describe("ERC721 Voting Tests", () => {
    it("Many users vote (+ and -)", async () => {
      const startBalance = await token2.balanceOf(proposer.address);

      const tokenId = 99;
      const targets = [token2Addr];
      const values = [0];
      const calldatas = [
        token2.interface.encodeFunctionData("mint", [proposer.address, tokenId]),
      ];
      const description = "Mint additional token ID to proposer";

      await governance.connect(proposer).propose(targets, values, calldatas, description);

      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
      const proposalId = await governance.hashProposal(targets, values, calldatas, descriptionHash);

      await mineBlocks(2);

      await governance.connect(proposer).castVote(proposalId, 1);
      await governance.connect(voter1).castVote(proposalId, 1);
      await governance.connect(voter2).castVote(proposalId, 0);

      await mineBlocks(5);

      const state = await governance.state(proposalId);
      expect(state).to.equal(4);

      await governance.connect(proposer).queue(targets, values, calldatas, descriptionHash);

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);
      await governance.connect(proposer).execute(targets, values, calldatas, descriptionHash);

      const finalBalance = await token2.balanceOf(proposer.address);
      expect(finalBalance).to.equal(startBalance + 1n);
    });

    it("Other vote, while one proposal executes", async () => {
      const startBalance = await token2.balanceOf(voter1.address);
      const startBalance2 = await token2.balanceOf(voter2.address);

      const proposal1TokenId = 5;
      const proposal2TokenId = 6;

      const proposal1Targets = [token2Addr];
      const proposal1Values = [0];
      const proposal1Calldatas = [
        token2.interface.encodeFunctionData("mint", [voter1.address, proposal1TokenId]),
      ];
      const proposal1Description = "Mint additional token to voter1";

      const proposal2Targets = [token2Addr];
      const proposal2Values = [0];
      const proposal2Calldatas = [
        token2.interface.encodeFunctionData("mint", [voter2.address, proposal2TokenId]),
      ];
      const proposal2Description = "Mint additional token to voter2";

      await governance.connect(proposer).propose(
        proposal1Targets,
        proposal1Values,
        proposal1Calldatas,
        proposal1Description
      );
      await governance.connect(proposer).propose(
        proposal2Targets,
        proposal2Values,
        proposal2Calldatas,
        proposal2Description
      );

      const proposal1DescriptionHash = ethers.keccak256(ethers.toUtf8Bytes(proposal1Description));
      const proposal2DescriptionHash = ethers.keccak256(ethers.toUtf8Bytes(proposal2Description));
      const proposal1Id = await governance.hashProposal(
        proposal1Targets,
        proposal1Values,
        proposal1Calldatas,
        proposal1DescriptionHash
      );

      const proposal2Id = await governance.hashProposal(
        proposal2Targets,
        proposal2Values,
        proposal2Calldatas,
        proposal2DescriptionHash
      );

      await mineBlocks(2);

      await governance.connect(proposer).castVote(proposal1Id, 1);
      await governance.connect(voter1).castVote(proposal1Id, 1);
      await governance.connect(voter2).castVote(proposal1Id, 0);

      await governance.connect(proposer).castVote(proposal2Id, 1);
      await governance.connect(voter1).castVote(proposal2Id, 0);
      await governance.connect(voter2).castVote(proposal2Id, 1);

      await mineBlocks(5);

      expect(await governance.state(proposal1Id)).to.equal(4);
      expect(await governance.state(proposal2Id)).to.equal(4);

      await governance.connect(proposer).queue(
        proposal1Targets,
        proposal1Values,
        proposal1Calldatas,
        proposal1DescriptionHash
      );

      await governance.connect(proposer).queue(
        proposal2Targets,
        proposal2Values,
        proposal2Calldatas,
        proposal2DescriptionHash
      );

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await governance.connect(proposer).execute(
        proposal1Targets,
        proposal1Values,
        proposal1Calldatas,
        proposal1DescriptionHash
      );

      await governance.connect(proposer).execute(
        proposal2Targets,
        proposal2Values,
        proposal2Calldatas,
        proposal2DescriptionHash
      );

      const finalBalance = await token2.balanceOf(voter1.address);
      expect(finalBalance).to.equal(startBalance + 1n);

      const finalBalance2 = await token2.balanceOf(voter2.address);
      expect(finalBalance2).to.equal(startBalance2 + 1n);
    });
  });
});