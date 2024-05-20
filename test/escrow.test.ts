import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { Escrow, MockERC20 } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { INSUFFICIENT_FUNDS_ERR, NOT_A_CONTRACT_ERR, NOT_AUTHORIZED_ERR, ZERO_AMOUNT_ERR } from "./helpers/errors";

// TODO esc: update solhint, oz packages and hardhat
describe("Escrow Contract", () => {
  let mockERC20 : MockERC20;
  let escrow : Escrow;
  let owner : SignerWithAddress;
  let addr1 : SignerWithAddress;
  let addr2 : SignerWithAddress;
  let operator1 : SignerWithAddress;
  let operator2 : SignerWithAddress;
  let escrowAddress : string;

  const initialMintAmountOwner = ethers.parseEther("9000000000000000000000");
  const initialMintAmountAddr1 = ethers.parseEther("1000");
  const initialMintAmountAddr2 = ethers.parseEther("500");

  before(async () => {
    [
      owner,
      addr1,
      addr2,
      operator1,
      operator2,
    ] = await hre.ethers.getSigners();

    const MockERC20Factory = await hre.ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20Factory.deploy("MockToken", "MTK");

    const escrowFactory = await hre.ethers.getContractFactory("Escrow");
    escrow = await escrowFactory.connect(owner).deploy(
      await mockERC20.getAddress(),
      owner.address,
      [operator1.address]
    );
    escrowAddress = await escrow.getAddress();

    await mockERC20.mint(owner, initialMintAmountOwner);
    await mockERC20.transfer(escrowAddress, "1000000000000000000000");
    await mockERC20.mint(addr1.address, initialMintAmountAddr1);
    await mockERC20.mint(addr2.address, initialMintAmountAddr2);
    await mockERC20.connect(addr1).approve(escrowAddress, ethers.parseEther("9999999999999999999999"));
    await mockERC20.connect(addr2).approve(escrowAddress, ethers.parseEther("9999999999999999999999"));
  });

  describe("Deploy", () => {
    it("Should set the right owner", async () => {
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it("Should set the right token contract", async () => {
      expect(await escrow.token()).to.equal(await mockERC20.getAddress());
    });

    it("Should assign operators in the constructor if they are passed", async () => {
      expect(await escrow.isOperator(operator1.address)).to.equal(true);
    });

    it("Should revert if _token is passed as a non-contract address", async () => {
      const EscrowFactory = await hre.ethers.getContractFactory("Escrow");
      await expect(EscrowFactory.deploy(owner.address, owner.address, [operator1.address]))
        .to.be.revertedWithCustomError(escrow, NOT_A_CONTRACT_ERR);
    });
  });

  describe("Fund Management - Success Scenarios", () => {
    const depositAmount = ethers.parseEther("100");

    it("Should allow deposits", async () => {
      await mockERC20.connect(addr1).approve(escrowAddress, depositAmount);
      await expect(escrow.connect(addr1).deposit(depositAmount))
        .to.emit(escrow, "Deposit")
        .withArgs(addr1.address, depositAmount);

      expect(await escrow.balances(addr1.address)).to.equal(depositAmount);
    });

    it("Should allow to #releaseFunds() by the owner/operator", async () => {
      await expect(escrow.connect(owner).releaseFunds(addr1.address, depositAmount))
        .to.emit(escrow, "FundsReleased")
        .withArgs(addr1.address, depositAmount);

      expect(await escrow.balances(addr1.address)).to.equal(ethers.parseEther("0"));
      expect(await mockERC20.balanceOf(addr1.address)).to.equal(initialMintAmountAddr1);
    });

    it("Should re-deposit", async () => {
      await mockERC20.connect(addr1).approve(escrowAddress, depositAmount);
      await expect(escrow.connect(addr1).deposit(depositAmount))
        .to.emit(escrow, "Deposit")
        .withArgs(addr1.address, depositAmount);

      expect(await escrow.balances(addr1.address)).to.equal(depositAmount);
    });

    it("Should allow withdrawal", async () => {
      const escBalBefore = await escrow.balances(addr1.address);
      const tokenBalBefore = await mockERC20.balanceOf(addr1.address);

      await expect(escrow.connect(addr1).withdraw(depositAmount))
        .to.emit(escrow, "Withdrawal")
        .withArgs(addr1.address, depositAmount);

      const escBalAfter = await escrow.balances(addr1.address);
      const tokenBalAfter = await mockERC20.balanceOf(addr1.address);

      expect(escBalAfter).to.equal(escBalBefore - depositAmount);
      expect(tokenBalAfter).to.equal(tokenBalBefore + depositAmount);
    });

    it("Should handle withdrawal after multiple deposits", async () => {
      const prevBalance = await escrow.balances(addr1.address);
      const depositAmounts = ["1000000000000000000", "2000000000000000000"];
      let totalDeposit = 0n;

      for (const amountStr of depositAmounts) {
        await mockERC20.connect(addr1).approve(escrowAddress, amountStr);
        const amount = BigInt(amountStr);
        await escrow.connect(addr1).deposit(amountStr);
        totalDeposit += amount;
      }

      expect(BigInt(await escrow.balances(addr1.address))).to.equal(totalDeposit + prevBalance);

      await escrow.connect(addr1).withdraw(totalDeposit + prevBalance);

      expect(BigInt(await escrow.balances(addr1.address))).to.equal(0n);
    });

    it("Should revert on attempt to withdraw with zero balance", async () => {
      await expect(escrow.connect(addr2).withdraw(10n))
        .to.be.revertedWithCustomError(escrow, INSUFFICIENT_FUNDS_ERR)
        .withArgs(addr2.address);
    });

    it("Should revert on 0 balance to releaseFunds", async () => {
      await expect(escrow.connect(owner).releaseFunds(addr1.address, depositAmount))
        .to.be.revertedWithCustomError(escrow, INSUFFICIENT_FUNDS_ERR);
    });

    it("Should revert if depositing zero amount", async () => {
      await expect(escrow.connect(addr1).deposit(0n))
        .to.be.revertedWithCustomError(escrow, ZERO_AMOUNT_ERR);
    });

    it("Should revert withdrawals when balance is zero or withdrawing more than balance", async () => {
      await expect(
        escrow.connect(addr2).withdraw(1000000n)
      ).to.be.revertedWithCustomError(escrow, INSUFFICIENT_FUNDS_ERR)
        .withArgs(addr2.address);

      const depAmt = ethers.parseEther("2");
      await mockERC20.connect(addr1).approve(escrowAddress, depAmt);
      await escrow.connect(addr1).deposit(depAmt);

      await expect(
        escrow.connect(addr1).withdraw(depAmt * 6n)
      ).to.be.revertedWithCustomError(escrow, INSUFFICIENT_FUNDS_ERR)
        .withArgs(addr1.address);
    });

    it("Should handle multiple consecutive deposits and withdrawals correctly", async () => {
      const currentBalanceStore = await mockERC20.balanceOf(addr1.address);

      const depAmt = ethers.parseEther("100");
      const anotherDepositAmount = ethers.parseEther("200");

      const prevBalance = await escrow.balances(addr1.address);
      await mockERC20.connect(addr1).approve(await escrow.getAddress(), depAmt + anotherDepositAmount);

      await escrow.connect(addr1).deposit(depAmt);
      await escrow.connect(addr1).deposit(anotherDepositAmount);

      expect(
        await escrow.balances(addr1.address)
      ).to.equal(depAmt + anotherDepositAmount + prevBalance);

      await escrow.connect(addr1).withdraw(depAmt);
      await escrow.connect(addr1).withdraw(anotherDepositAmount);
      await escrow.connect(addr1).withdraw(prevBalance);

      expect(await escrow.balances(addr1.address)).to.equal(0);
      expect(await mockERC20.balanceOf(addr1.address)).to.equal(currentBalanceStore + prevBalance);
    });

    it("Should emit the correct events and update balances on multiple #releaseFunds()", async () => {
      const depositAmt = ethers.parseEther("50");
      const doubleDepositAmt = depositAmt + depositAmt;
      await mockERC20.connect(addr1).approve(await escrow.getAddress(), doubleDepositAmt);
      await escrow.connect(addr1).deposit(depositAmt);
      await escrow.connect(addr1).deposit(depositAmt);

      await expect(escrow.connect(owner).releaseFunds(addr1.address, doubleDepositAmt))
        .to.emit(escrow, "FundsReleased")
        .withArgs(addr1.address, doubleDepositAmt);

      const leftoverBal = await escrow.balances(addr1.address);

      await expect(
        escrow.connect(owner).releaseFunds(addr1.address, leftoverBal)
      ).to.emit(escrow, "FundsReleased")
        .withArgs(addr1.address, leftoverBal);

      expect(await escrow.balances(addr1.address)).to.equal(0);
    });
  });

  describe("Fund Management - Failure Scenarios", () => {
    it("Should fail an unauthorized #releaseFunds() call", async () => {
      await expect(escrow.connect(addr1).releaseFunds(addr2.address, 1n))
        .to.be.revertedWithCustomError(escrow, NOT_AUTHORIZED_ERR)
        .withArgs(addr1.address);
    });

    it("Should revert #releaseFunds() called by non-owner/operator", async () => {
      await expect(escrow.connect(operator2).releaseFunds(addr1.address, ethers.parseEther("100")))
        .to.be.revertedWithCustomError(escrow, NOT_AUTHORIZED_ERR)
        .withArgs(operator2.address);
    });
  });

  describe("Deposits of different grade amounts", () => {
    const testAmounts = ["0", "1", "100", "10000000", "1000000000000000000"];

    for (const amountStr of testAmounts) {
      it(`Should handle deposit of ${amountStr} wei correctly`, async () => {
        await mockERC20.connect(addr1).approve(escrowAddress, amountStr);
        const amount = BigInt(amountStr);
        if (amount === 0n) {
          await expect(escrow.deposit(amountStr))
            .to.be.revertedWithCustomError(escrow, ZERO_AMOUNT_ERR);
        } else {
          const initialBalance = BigInt(await escrow.balances(addr1.address));
          await escrow.connect(addr1).deposit(amountStr);
          const finalBalance = BigInt(await escrow.balances(addr1.address));
          expect(finalBalance).to.equal(initialBalance + amount);
        }
      });
    }
  });
});
