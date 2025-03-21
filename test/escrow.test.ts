import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { Escrow, MockERC20 } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { INSUFFICIENT_FUNDS_ERR, NOT_A_CONTRACT_ERR, ZERO_AMOUNT_ERR } from "./helpers/errors";


describe("Escrow Contract", () => {
  let mockERC20 : MockERC20;
  let escrow : Escrow;
  let owner : SignerWithAddress;
  let addr1 : SignerWithAddress;
  let addr2 : SignerWithAddress;
  let operator1 : SignerWithAddress;
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

  describe("Fund Management", () => {
    const depositAmount = ethers.parseEther("100");

    it("Should allow deposits", async () => {
      await mockERC20.connect(addr1).approve(escrowAddress, depositAmount);
      await expect(escrow.connect(addr1).deposit(depositAmount))
        .to.emit(escrow, "Deposit")
        .withArgs(addr1.address, depositAmount, depositAmount);

      expect(await escrow.balances(addr1.address)).to.equal(depositAmount);
    });

    it("Should re-deposit", async () => {
      await mockERC20.connect(addr1).approve(escrowAddress, depositAmount);
      await expect(escrow.connect(addr1).deposit(depositAmount))
        .to.emit(escrow, "Deposit")
        .withArgs(addr1.address, depositAmount, depositAmount);

      expect(await escrow.balances(addr1.address)).to.equal(depositAmount * 2n);
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

    it("Should revert if depositing zero amount", async () => {
      await expect(escrow.connect(addr1).deposit(0n))
        .to.be.revertedWithCustomError(escrow, ZERO_AMOUNT_ERR);
    });

    it("Should revert if withdrawing zero amount", async () => {
      await expect(escrow.connect(addr1).withdraw(0n))
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

  it("Should properly support deflationary a token", async () => {
    const deflationaryTokenFactory = await hre.ethers.getContractFactory("DeflERC20Mock");
    const deflToken = await deflationaryTokenFactory.connect(owner).deploy("DeflationaryToken", "DEFT");
    const escrowFactory = await hre.ethers.getContractFactory("Escrow");
    const escrowLocal = await escrowFactory.connect(owner).deploy(
      deflToken.target,
      owner.address,
      [operator1.address]
    );

    const depositAmount = ethers.parseEther("77531");

    const totalSupplyBefore = await deflToken.totalSupply();
    await deflToken.connect(owner).approve(escrowLocal.target, depositAmount);

    const transferFeeDeposit = await deflToken.getFee(depositAmount);

    const tokenBalanceBefore = await deflToken.balanceOf(owner.address);
    const escrowBalanceBefore = await escrowLocal.balances(owner.address);


    // deposit and check the event in one go
    await expect(
      escrowLocal.connect(owner).deposit(depositAmount)
    ).to.emit(escrowLocal, "Deposit")
      .withArgs(owner.address, depositAmount, depositAmount - transferFeeDeposit);

    const totalSupplyAfterDeposit = await deflToken.totalSupply();
    const tokenBalanceAfterDeposit = await deflToken.balanceOf(owner.address);
    const escrowBalanceAfterDeposit = await escrowLocal.balances(owner.address);

    expect(tokenBalanceBefore - tokenBalanceAfterDeposit).to.equal(depositAmount);
    expect(escrowBalanceAfterDeposit - escrowBalanceBefore).to.equal(depositAmount - transferFeeDeposit);
    expect(totalSupplyBefore - totalSupplyAfterDeposit).to.equal(transferFeeDeposit);

    // withdrawing the same amount should fail, because the actual transferred amount was `depositAmount - transferFee`
    await expect(
      escrowLocal.connect(owner).withdraw(depositAmount)
    ).to.be.revertedWithCustomError(escrowLocal, INSUFFICIENT_FUNDS_ERR);

    const withdrawAmount = depositAmount - transferFeeDeposit;
    const transferFeeWithdraw = await deflToken.getFee(withdrawAmount);
    // correct amount withdrawal
    await escrowLocal.connect(owner).withdraw(withdrawAmount);

    const tokenBalanceAfterWithdraw = await deflToken.balanceOf(owner.address);
    const escrowBalanceAfterWithdraw = await escrowLocal.balances(owner.address);
    const totalSupplyAfterWithdraw = await deflToken.totalSupply();

    expect(
      tokenBalanceAfterWithdraw - tokenBalanceAfterDeposit
    ).to.equal(
      depositAmount - transferFeeDeposit - transferFeeWithdraw
    );
    expect(escrowBalanceAfterWithdraw).to.equal(0);
    expect(totalSupplyAfterWithdraw).to.equal(totalSupplyAfterDeposit - transferFeeWithdraw);
  });
});
