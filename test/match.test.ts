import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Escrow, Match } from "../typechain"; // Adjust the import path according to your project structure
import { ERC20TestToken } from "../typechain"; // Adjust assuming you have a mock ERC20 for testing


describe("Match Contract",  () => {
  let mockERC20 : ERC20TestToken;
  let match : Match;

  let owner : SignerWithAddress;
  let addr1 : SignerWithAddress;
  let addr2 : SignerWithAddress;
  let ownerAddress : string;
  let addr1Address : string;
  let addr2Address : string;
  let mockERC20Address : string;
  let matchAddress : string;
  const ownerMintAmount = ethers.parseEther("100000000000000000000");

  before(async () => {
    [owner, addr1, addr2] = await hre.ethers.getSigners();
    ownerAddress = await owner.getAddress();
    addr1Address = await addr1.getAddress();
    addr2Address = await addr2.getAddress();

    const MockERC20Factory = await hre.ethers.getContractFactory("ERC20TestToken");
    mockERC20 = (await MockERC20Factory.deploy("MockToken", "MTK")) as ERC20TestToken;
    mockERC20Address = await mockERC20.getAddress();

    const MatchFactory = await hre.ethers.getContractFactory("Match");
    match = (await MatchFactory.deploy(mockERC20Address, ownerAddress)) as Match;
    matchAddress = await match.getAddress();

    await mockERC20.mint(addr1Address, ethers.parseEther("1000"));
    await mockERC20.mint(addr2Address, ethers.parseEther("500"));
    // await mockERC20.mint(matchAddress, ethers.parseEther("1000000"));
    await mockERC20.mint(owner, ownerMintAmount);
    await mockERC20.connect(owner).increaseAllowance(matchAddress, ownerMintAmount);
  });

  describe("Match Operations", () => {
    it("Should correctly determine if players can match based on match balance", async () => {
      const depositAmount = ethers.parseEther("100");
      await mockERC20.connect(addr1).approve(matchAddress, depositAmount);
      await match.connect(addr1).deposit(depositAmount);

      await expect(
        match.canMatch([addr1Address, addr2Address], depositAmount)
      ).to.be.revertedWithCustomError(
        match,
        "PlayersNotFunded"
      );

      await mockERC20.connect(addr2).approve(matchAddress, depositAmount);
      await match.connect(addr2).deposit(depositAmount);
      await match.canMatch([addr1Address, addr2Address], depositAmount);
    });

    it("Should pay winners variable amounts and emit Payment event for each", async () => {
      const balance1Before = await match.balance(addr1Address);
      const balance2Before = await match.balance(addr2Address);
      const amt1 = ethers.parseEther("25");
      const amt2 = ethers.parseEther("75");
      const amounts = [amt1, amt2];
      const winners = [addr1Address, addr2Address];

      await match.connect(owner).payAllAmounts(amounts, winners);

      // Check final balances
      const addr1FinalBalance = await match.balance(addr1Address);
      const addr2FinalBalance = await match.balance(addr2Address);
      expect(addr1FinalBalance).to.equal(balance1Before + amt1);
      expect(addr2FinalBalance).to.equal(balance2Before + amt2);
    });
  });

  describe("Start match", () => {
    it("Should correctly determine if players can match based on match balance", async () => {
      const depositAmount = ethers.parseEther("100");
      await mockERC20.connect(addr1).approve(matchAddress, depositAmount);
      await match.connect(addr1).deposit(depositAmount);
      await mockERC20.connect(addr2).approve(matchAddress, depositAmount);
      await match.connect(addr2).deposit(depositAmount);
      await match.canMatch([addr1Address, addr2Address], depositAmount);
    });

    it("Should fail if players are not funded", async () => {
      // Assuming addr1 and addr2 have insufficient balance
      const players = [addr1.address, addr2.address];
      const entryFee = ethers.parseEther("10000000000000000000000000");
      await expect(match.startMatch(players, entryFee))
        .to.be.revertedWithCustomError(match, "PlayersNotFunded");
    });

    it("Should not start a match with an empty players array", async () => {
      const entryFee = ethers.parseUnits("1", "wei"); // Smallest possible entry fee
      await expect(match.startMatch([], entryFee))
        .to.be.revertedWith("No players"); // Use the correct revert message from your contract
    });

    it("Should start a match with valid players and entry fee", async () => {
      const players = [addr1.address, addr2.address];
      const entryFee = ethers.parseEther("1");
      await expect(match.startMatch(players, entryFee))
        .to.emit(match, "MatchStarted")
        .withArgs(1n, players, entryFee);
    });
  });

  describe("End Match", () => {
    const matchId = 0;
    it("Should fail if the match does not exist", async () => {
      const invalidMatchId = 999; // Use an ID for a match that doesn't exist
      await expect(match.endMatch(invalidMatchId, [addr1.address], [ethers.parseEther("1")]))
        .to.be.revertedWith("Match does not exist");
    });

    it("Should fail if winners and winAmounts array lengths mismatch", async () => {
      await expect(match.endMatch(matchId, [addr1.address], [ethers.parseEther("1"), ethers.parseEther("2")]))
        .to.be.revertedWith("Array lengths mismatch");
    });

    it("Should correctly end the match and pay winners", async () => {
      const winners = [addr1.address, addr2.address];
      const winAmounts = [ethers.parseEther("1"), ethers.parseEther("2")];

      // Balances before ending the match
      const initialBalances = await Promise.all(winners.map(async winner => await match.balance(winner)));

      // End the match
      const tx = await match.endMatch(matchId, winners, winAmounts);
      await tx.wait();

      // Validate winners' balances increased by winAmounts
      await Promise.all(winners.map(async (winner, index) => {
        const finalBalance = await match.balance(winner);
        const expectedBalance = initialBalances[index] + winAmounts[index];
        expect(finalBalance).to.equal(expectedBalance);
      }));
    });
  });
});