import { ethers } from "hardhat";
import { expect } from "chai";
import { TimelockController, ZDAO, ZeroVotingERC20, ZeroVotingERC721 } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { mineBlocks } from "./helpers/voting/mineBlocks";


describe("Governance Flow Test", () => {
  let votingERC20 : ZeroVotingERC20;
  let votingERC721 : ZeroVotingERC721;
  let governance20 : ZDAO;
  let governance721 : ZDAO;
  let timelock : TimelockController;

  let admin : SignerWithAddress;
  let user1 : SignerWithAddress;
  let user2 : SignerWithAddress;

  const initialUser1Balance = ethers.parseUnits("100");
  const initialUser2Balance = ethers.parseUnits("20");

  const delay = 1;
  const votingPeriod = 10;
  const proposalThreshold20 = ethers.parseUnits("100");
  const proposalThreshold721 = 1;
  const quorumPercentage = 10;
  const voteExtension = 5;

  before(async () => {
    // Get signers
    [admin, user1, user2] = await ethers.getSigners();

    // Deploy Governance Token (ERC20)
    const VotingERC20 = await ethers.getContractFactory("ZeroVotingERC20");
    votingERC20 = await VotingERC20.deploy(
      "ZeroVotingERC20",
      "ZV",
      admin
    );
    await votingERC20.waitForDeployment();

    // Deploy Governance Token (ERC721)
    const VotingERC721 = await ethers.getContractFactory("ZeroVotingERC721");
    votingERC721 = await VotingERC721.deploy(
      "ZeroVotingERC721",
      "ZV721",
      "1.0",
      "dummyURI",
      admin,
    );
    await votingERC721.waitForDeployment();

    // Timelock deployment
    const timelockFact = await ethers.getContractFactory("TimelockController");
    timelock = await timelockFact.deploy(1, [], [], admin.address);

    // Deploy Governance20 Contract
    const Governance20 = await ethers.getContractFactory("ZDAO");
    governance20 = await Governance20.deploy(
      "ZDAO",
      votingERC20,
      await timelock.getAddress(),
      delay,
      votingPeriod,
      proposalThreshold20,
      quorumPercentage,
      voteExtension,
    );
    await governance20.waitForDeployment();

    // Deploy Governance20 Contract
    const Governance721 = await ethers.getContractFactory("ZDAO");
    governance721 = await Governance721.deploy(
      "ZDAO",
      votingERC721,
      await timelock.getAddress(),
      delay,
      votingPeriod,
      proposalThreshold721,
      quorumPercentage,
      voteExtension,
    );
    await governance721.waitForDeployment();

    // Grant proposer and executor role to the gov contract to use proposals
    await timelock.grantRole(await timelock.PROPOSER_ROLE(), await governance20.getAddress());
    await timelock.grantRole(await timelock.EXECUTOR_ROLE(), await governance20.getAddress());
    // Grant minter role to the timelock to let it execute proposal on mint
    await votingERC20.grantRole(await votingERC20.MINTER_ROLE(), await timelock.getAddress());

    // Mint tokens to users
    await votingERC20.connect(admin).mint(user1.address, initialUser1Balance);
    await votingERC20.connect(admin).mint(user2.address, initialUser2Balance);

    // Delegate tokens to themselves for voting power
    await votingERC20.connect(user1).delegate(user1.address);
    await votingERC20.connect(user2).delegate(user2.address);

    // Grant proposer and executor roles to governance contract
    await timelock.grantRole(await timelock.PROPOSER_ROLE(), await governance721.getAddress());
    await timelock.grantRole(await timelock.EXECUTOR_ROLE(), await governance721.getAddress());

    // Grant minter role to the timelock to execute proposals
    await votingERC721.grantRole(await votingERC721.MINTER_ROLE(), await timelock.getAddress());

    // Mint tokens to users
    await votingERC721.connect(admin).mint(user1.address, 1, "");
    await votingERC721.connect(admin).mint(user2.address, 2, "");

    // Delegate tokens to themselves for voting power
    await votingERC721.connect(user1).delegate(user1.address);
    await votingERC721.connect(user2).delegate(user2.address);
  });

  it("Should properly retrieve and count votes during voting", async () => {
    // Define proposal details
    const targets = [votingERC20];
    const values = [0];
    const mintAmount = ethers.parseUnits("50");
    const calldatas = [
      votingERC20.interface.encodeFunctionData("mint", [user1.address, mintAmount]),
    ];
    const description = "Mint 50 tokens to user1";
    const descriptionHash = await ethers.keccak256(
      ethers.toUtf8Bytes(description)
    );

    // Create proposal
    await governance20.connect(user1).propose(
      targets,
      values,
      calldatas,
      description
    );

    const proposalId = await governance20.hashProposal(
      targets,
      values,
      calldatas,
      descriptionHash
    );

    // Move blocks forward to allow voting
    await mineBlocks(Number(votingPeriod));

    // Vote on the proposal
    await governance20.connect(user1).castVote(proposalId, 1);
    await governance20.connect(user2).castVote(proposalId, 0);

    // Get votes for and against
    const {
      forVotes,
      againstVotes,
    } = await governance20.proposalVotes(proposalId);

    expect(
      forVotes
    ).to.be.eq(
      initialUser1Balance
    );

    expect(
      againstVotes
    ).to.be.eq(
      initialUser2Balance
    );

    // Move blocks forward to allow the proposal to succeed
    await mineBlocks(Number(votingPeriod));

    // Queue the proposal
    await governance20.queue(
      targets,
      values,
      calldatas,
      descriptionHash
    );

    // Execute the proposal
    await governance20.execute(
      targets,
      values,
      calldatas,
      descriptionHash
    );

    expect(
      await votingERC20.balanceOf(user1.address)
    ).to.equal(
      initialUser1Balance + mintAmount
    );
  });

  it("Should properly retrieve and count votes during voting (ERC721)", async () => {
    // Define proposal details
    const targets = [votingERC721];
    const values = [0];
    const calldatas = [
      votingERC721.interface.encodeFunctionData("mint", [user1.address, 3, ""]),
    ];
    const description = "Mint token ID 3 to user1";
    const descriptionHash = await ethers.keccak256(
      ethers.toUtf8Bytes(description)
    );

    // Create proposal
    await governance721.connect(user1).propose(
      targets,
      values,
      calldatas,
      description
    );

    const proposalId = await governance721.hashProposal(
      targets,
      values,
      calldatas,
      descriptionHash
    );

    // Move blocks forward to allow voting
    await mineBlocks(Number(votingPeriod));

    // Vote on the proposal
    await governance721.connect(user1).castVote(proposalId, 1);
    await governance721.connect(user2).castVote(proposalId, 1);

    // Get votes for and against
    const {
      forVotes,
      againstVotes,
    } = await governance721.proposalVotes(proposalId);

    expect(
      forVotes
    ).to.be.eq(
      2
    );
    expect(
      againstVotes
    ).to.be.eq(
      0
    );

    // Move blocks forward to allow the proposal to succeed
    await mineBlocks(Number(votingPeriod));

    // Queue the proposal
    await governance721.queue(
      targets,
      values,
      calldatas,
      descriptionHash
    );

    // Execute the proposal
    await governance721.execute(
      targets,
      values,
      calldatas,
      descriptionHash
    );

    expect(
      await votingERC721.ownerOf(3)
    ).to.equal(
      user1.address
    );
  });
});
