import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { Escrow } from "../typechain";
import { ERC20TestToken } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Escrow Contract", function () {
  let mockERC20: ERC20TestToken;
  let escrow: Escrow;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  const initialMintAmountOwner = ethers.parseEther("9000000000000000000000");
  const initialMintAmountAddr1 = ethers.parseEther("1000");
  const initialMintAmountAddr2 = ethers.parseEther("500");

  before(async function () {
    const signers: SignerWithAddress[] = await hre.ethers.getSigners();
    owner = signers[0];
    addr1 = signers[1];
    addr2 = signers[2];

    const ownerAddress = await owner.getAddress();

    const MockERC20Factory = await hre.ethers.getContractFactory("ERC20TestToken");
    mockERC20 = (await MockERC20Factory.deploy("MockToken", "MTK")) as ERC20TestToken;

    const escrowFactory = await hre.ethers.getContractFactory("Escrow");
    escrow = (await escrowFactory.deploy(await mockERC20.getAddress(), ownerAddress)) as Escrow;
    const escrowAddress = escrow.getAddress();
    // Mint some tokens to test accounts
    await mockERC20.mint(owner, initialMintAmountOwner);
    //await mockERC20.increaseAllowance(escrowAddress, initialMintAmountOwner);
    await mockERC20.transfer(escrowAddress, "1000000000000000000000")
    await mockERC20.mint(addr1.address, initialMintAmountAddr1);
    await mockERC20.mint(addr2.address, initialMintAmountAddr2);
  });

  describe("Deploy Escrow", function () {
    it("Should set the right owner", async function () {
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it("Should set the right token contract", async function () {
      expect(await escrow.token()).to.equal(await mockERC20.getAddress());
    });
  });

  describe("Escrow", function () {
    const depositAmount = ethers.parseEther("100");
    const paymentAmount = ethers.parseEther("50");
    const finalBalanceExpected = ethers.parseEther("150");
    const addr1FinalTokenBalance = ethers.parseEther("1050");

    it("Should allow deposits", async function () {
      await mockERC20.connect(addr1).approve(await escrow.getAddress(), depositAmount);
      await expect(escrow.connect(addr1).deposit(depositAmount))
        .to.emit(escrow, "Deposit")
        .withArgs(addr1.address, depositAmount);

      expect(await escrow.balance(addr1.address)).to.equal(depositAmount);
    });

    it("Should allow refund", async function () {
      await expect(escrow.connect(owner).refund(addr1.address))
        .to.emit(escrow, "Refund")
        .withArgs(addr1.address, depositAmount);

      expect(await escrow.balance(addr1.address)).to.equal(ethers.parseEther("0"));
      expect(await mockERC20.balanceOf(addr1.address)).to.equal(initialMintAmountAddr1);
    });

    it("Should re-deposit", async function () {
      await mockERC20.connect(addr1).approve(await escrow.getAddress(), depositAmount);
      await expect(escrow.connect(addr1).deposit(depositAmount))
        .to.emit(escrow, "Deposit")
        .withArgs(addr1.address, depositAmount);

      expect(await escrow.balance(addr1.address)).to.equal(depositAmount);
    });

    it("Should execute payments", async function () {
      await expect(escrow.connect(owner).pay(addr1.address, paymentAmount))
        .to.emit(escrow, "Payment")
        .withArgs(addr1.address, paymentAmount);

      const finalBalance = await escrow.balance(addr1.address);
      expect(finalBalance).to.equal(finalBalanceExpected);
    });

    it("Should allow withdrawal", async function () {
      const finalBalance = await escrow.balance(addr1.address);
      await expect(escrow.connect(addr1).withdraw())
        .to.emit(escrow, "Withdrawal")
        .withArgs(addr1.address, finalBalance);
      const balNow = await mockERC20.balanceOf(addr1.address);
      expect(balNow).to.equal(addr1FinalTokenBalance);
    });

    it("Should revert on 0 balance to refund", async function () {
      await expect(escrow.connect(owner).refund(addr1.address))
        .to.be.revertedWith("No balance to refund");
    });
    it("Should correctly handle deposits of zero amount", async function () {
      await expect(escrow.connect(addr1).deposit(0))
        .to.be.revertedWith("Zero deposit amount");
    });

    it("Should reject withdrawals when balance is zero", async function () {
      await expect(escrow.connect(addr2).withdraw())
        .to.be.revertedWith("No balance to withdraw");
    });

    it("Should handle multiple consecutive deposits and withdrawals correctly", async function () {
      const currentBalanceStore = await mockERC20.balanceOf(addr1.address);
      const depositAmount = ethers.parseEther("100");
      const anotherDepositAmount = ethers.parseEther("200");
      await mockERC20.connect(addr1).approve(await escrow.getAddress(), depositAmount + anotherDepositAmount);
      await escrow.connect(addr1).deposit(depositAmount);
      await escrow.connect(addr1).deposit(anotherDepositAmount);

      // Check combined balance
      expect(await escrow.balance(addr1.address)).to.equal(depositAmount + anotherDepositAmount);

      // Withdraw all
      await escrow.connect(addr1).withdraw();
      expect(await escrow.balance(addr1.address)).to.equal(0);
      expect(await mockERC20.balanceOf(addr1.address)).to.equal(currentBalanceStore);
    });

    it("Should emit the correct events and update balances on multiple refunds", async function () {

      const depositAmount = ethers.parseEther("50");
      await mockERC20.connect(addr1).approve(await escrow.getAddress(), depositAmount + depositAmount);
      await escrow.connect(addr1).deposit(depositAmount);
      await escrow.connect(addr1).deposit(depositAmount);

      await expect(escrow.connect(owner).refund(addr1.address))
        .to.emit(escrow, "Refund")
        .withArgs(addr1.address, depositAmount + depositAmount);
      expect(await escrow.balance(addr1.address)).to.equal(0);
    });
  });

  describe("Escrow, Negative Tests", function () {
    const excessiveAmount = ethers.parseEther("11000000000");
    const unauthorizedPaymentAmount = ethers.parseEther("10");

    it("Should fail for insufficient balance on payment", async function () {
      await expect(escrow.connect(owner).pay(addr1.address, excessiveAmount))
        .to.be.revertedWith("Contract not funded");
    });

    it("Should fail for unauthorized payment execution", async function () {
      await expect(escrow.connect(addr1).pay(addr2.address, unauthorizedPaymentAmount))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail for unauthorized refund", async function () {
      await expect(escrow.connect(addr1).refund(addr2.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
