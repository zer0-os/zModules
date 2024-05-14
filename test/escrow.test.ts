import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { Escrow, MockERC20 } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


describe("Escrow Contract", () => {
  let mockERC20 : MockERC20;
  let escrow : Escrow;
  let owner : SignerWithAddress;
  let addr1 : SignerWithAddress;
  let addr2 : SignerWithAddress;
  let addr1Address : string;
  let addr2Address : string;
  let escrowAddress : string;

  const initialMintAmountOwner = ethers.parseEther("9000000000000000000000");
  const initialMintAmountAddr1 = ethers.parseEther("1000");
  const initialMintAmountAddr2 = ethers.parseEther("500");

  before(async () => {
    const signers : Array<SignerWithAddress> = await hre.ethers.getSigners();
    owner = signers[0];
    addr1 = signers[1];
    addr2 = signers[2];
    addr1Address = await signers[1].getAddress();
    addr2Address = await signers[2].getAddress();

    const ownerAddress = await owner.getAddress();

    const MockERC20Factory = await hre.ethers.getContractFactory("ERC20TestToken");
    mockERC20 = (await MockERC20Factory.deploy("MockToken", "MTK")) as MockERC20;

    const escrowFactory = await hre.ethers.getContractFactory("Escrow");
    escrow = (await escrowFactory.deploy(await mockERC20.getAddress(), ownerAddress)) as Escrow;
    escrowAddress = await escrow.getAddress();

    await mockERC20.mint(owner, initialMintAmountOwner);
    await mockERC20.transfer(escrowAddress, "1000000000000000000000");
    await mockERC20.mint(addr1.address, initialMintAmountAddr1);
    await mockERC20.mint(addr2.address, initialMintAmountAddr2);
    await mockERC20.connect(addr1).approve(escrowAddress, ethers.parseEther("9999999999999999999999"));
    await mockERC20.connect(addr2).approve(escrowAddress, ethers.parseEther("9999999999999999999999"));
  });

  describe("Deploy Escrow", () => {
    it("Should set the right owner", async () => {
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it("Should set the right token contract", async () => {
      expect(await escrow.token()).to.equal(await mockERC20.getAddress());
    });
  });

  describe("Escrow", () => {
    const depositAmount = ethers.parseEther("100");
    const paymentAmount = ethers.parseEther("50");
    const addr1FinalTokenBalance = ethers.parseEther("1050");

    it("Should allow deposits", async () => {
      await mockERC20.connect(addr1).approve(escrowAddress, depositAmount);
      await expect(escrow.connect(addr1).deposit(depositAmount))
        .to.emit(escrow, "Deposit")
        .withArgs(addr1.address, depositAmount);

      expect(await escrow.balance(addr1.address)).to.equal(depositAmount);
    });

    it("Should allow refund", async () => {
      await expect(escrow.connect(owner).refund(addr1.address))
        .to.emit(escrow, "Refund")
        .withArgs(addr1.address, depositAmount);

      expect(await escrow.balance(addr1.address)).to.equal(ethers.parseEther("0"));
      expect(await mockERC20.balanceOf(addr1.address)).to.equal(initialMintAmountAddr1);
    });

    it("Should re-deposit", async () => {
      await mockERC20.connect(addr1).approve(await escrow.getAddress(), depositAmount);
      await expect(escrow.connect(addr1).deposit(depositAmount))
        .to.emit(escrow, "Deposit")
        .withArgs(addr1.address, depositAmount);

      expect(await escrow.balance(addr1.address)).to.equal(depositAmount);
    });

    it("Should execute payments", async () => {
      const finalBalanceExpected = ethers.parseEther("150");
      await expect(escrow.connect(owner).pay(addr1.address, paymentAmount))
        .to.emit(escrow, "Payment")
        .withArgs(addr1.address, paymentAmount);

      const finalBalance = await escrow.balance(addr1.address);
      expect(finalBalance).to.equal(finalBalanceExpected);
    });

    it("Should execute charges", async () => {
      const finalBalanceExpected = ethers.parseEther("149");
      const chargeAmount = ethers.parseEther("1");
      await expect(escrow.connect(owner).charge(addr1.address, chargeAmount))
        .to.emit(escrow, "Charge")
        .withArgs(addr1.address, chargeAmount);

      const finalBalance = await escrow.balance(addr1.address);
      expect(finalBalance).to.equal(finalBalanceExpected);
      await expect(escrow.connect(owner).pay(addr1.address, chargeAmount));
    });

    it("Should allow withdrawal", async () => {
      const finalBalance = await escrow.balance(addr1.address);
      await expect(escrow.connect(addr1).withdraw())
        .to.emit(escrow, "Withdrawal")
        .withArgs(addr1.address, finalBalance);
      const balNow = await mockERC20.balanceOf(addr1.address);
      expect(balNow).to.equal(addr1FinalTokenBalance);
    });

    it("Should handle withdrawal after multiple deposits", async () => {
      const prevBalance = await escrow.balance(addr1Address);
      const depositAmounts = ["1000000000000000000", "2000000000000000000"];
      let totalDeposit = 0n;

      for (const amountStr of depositAmounts) {
        await mockERC20.connect(addr1).approve(escrowAddress, amountStr);
        const amount = BigInt(amountStr);
        await escrow.connect(addr1).deposit(amountStr);
        totalDeposit += amount;
      }

      expect(BigInt(await escrow.balance(addr1.address))).to.equal(totalDeposit + prevBalance);

      await escrow.connect(addr1).withdraw();

      expect(BigInt(await escrow.balance(addr1Address))).to.equal(0n);
    });

    it("Should revert on attempt to withdraw with zero balance", async () => {
      await expect(escrow.connect(addr2).withdraw())
        .to.be.revertedWith("No balance to withdraw");
    });

    it("Should revert on 0 balance to refund", async () => {
      await expect(escrow.connect(owner).refund(addr1.address))
        .to.be.revertedWith("No balance to refund");
    });

    it("Should correctly handle deposits of zero amount", async () => {
      await expect(escrow.connect(addr1).deposit(0))
        .to.be.revertedWith("Zero deposit amount");
    });

    it("Should reject withdrawals when balance is zero", async () => {
      await expect(escrow.connect(addr2).withdraw())
        .to.be.revertedWith("No balance to withdraw");
    });

    it("Should handle multiple consecutive deposits and withdrawals correctly", async () => {
      const currentBalanceStore = await mockERC20.balanceOf(addr1.address);
      const depositAmount = ethers.parseEther("100");
      const anotherDepositAmount = ethers.parseEther("200");
      await mockERC20.connect(addr1).approve(await escrow.getAddress(), depositAmount + anotherDepositAmount);
      await escrow.connect(addr1).deposit(depositAmount);
      await escrow.connect(addr1).deposit(anotherDepositAmount);

      expect(await escrow.balance(addr1.address)).to.equal(depositAmount + anotherDepositAmount);

      await escrow.connect(addr1).withdraw();
      expect(await escrow.balance(addr1.address)).to.equal(0);
      expect(await mockERC20.balanceOf(addr1.address)).to.equal(currentBalanceStore);
    });

    it("should handle sequential payAllAmounts calls correctly", async () => {
      const balance1Before = await escrow.balance(addr1Address);
      const balance2Before = await escrow.balance(addr2Address);
      const paymentAmounts = [ethers.parseEther("1"), ethers.parseEther("9")];
      const winners = [addr1Address, addr2Address];
      await escrow.payAllAmounts(paymentAmounts, winners);
      await escrow.payAllAmounts(paymentAmounts, winners);

      const balance1 = await escrow.balance(addr1Address);
      const balance2 = await escrow.balance(addr2Address);
      const finalBal1 = balance1Before + paymentAmounts[0] + paymentAmounts[0];
      const finalBal2 = balance2Before + paymentAmounts[1] + paymentAmounts[1];
      expect(balance1).to.equal(finalBal1);
      expect(balance2).to.equal(finalBal2);
    });

    it("should handle sequential chargeAllAmounts calls correctly", async () => {
      const balance1Before = await escrow.balance(addr1Address);
      const balance2Before = await escrow.balance(addr2Address);
      const chargeAmounts = [ethers.parseEther("1"), ethers.parseEther("9")];
      const winners = [addr1Address, addr2Address];
      await escrow.chargeAllAmounts(chargeAmounts, winners);
      await escrow.chargeAllAmounts(chargeAmounts, winners);

      const balance1 = await escrow.balance(addr1Address);
      const balance2 = await escrow.balance(addr2Address);
      const finalBal1 = balance1Before - chargeAmounts[0] - chargeAmounts[0];
      const finalBal2 = balance2Before - chargeAmounts[1] - chargeAmounts[1];
      expect(balance1).to.equal(finalBal1);
      expect(balance2).to.equal(finalBal2);
    });

    it("Should emit the correct events and update balances on multiple refunds", async () => {
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

  describe("Escrow, Negative Tests", () => {
    const excessiveAmount = ethers.parseEther("11000000000");
    const unauthorizedPaymentAmount = ethers.parseEther("10");

    it("payAllAmounts fails when amounts and winners array lengths do not match", async () => {
      const amounts = [ethers.parseEther("10")];
      const winners = [addr1Address, addr2Address];
      await expect(escrow.payAllAmounts(amounts, winners))
        .to.be.revertedWith("Amounts and winners length mismatch");
    });

    it("chargeAllAmounts fails when amounts and clients array lengths do not match", async () => {
      const amounts = [ethers.parseEther("10")];
      const clients = [addr1Address, addr2Address];
      await expect(escrow.chargeAllAmounts(amounts, clients))
        .to.be.revertedWith("Amounts and clients length mismatch");
    });

    it("Reverts payAllAmounts with insufficient paymentAccount balance", async () => {
      const amounts = [ethers.parseEther("5000000000000000000000000000000000000000")];
      const winners = [addr2Address];
      await expect(escrow.payAllAmounts(amounts, winners))
        .to.be.revertedWith("Contract not funded");
    });

    it("Should fail for insufficient balance on payment", async () => {
      await expect(escrow.connect(owner).pay(addr1.address, excessiveAmount))
        .to.be.revertedWith("Contract not funded");
    });

    it("Should fail for balance underflow on charge", async () => {
      await expect(escrow.connect(owner).charge(addr1.address, excessiveAmount))
        .to.be.reverted;
    });

    it("Should fail for unauthorized payment execution", async () => {
      await expect(escrow.connect(addr1).pay(addr2.address, unauthorizedPaymentAmount))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail for unauthorized charge execution", async () => {
      await expect(escrow.connect(addr1).charge(addr2.address, unauthorizedPaymentAmount))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail for unauthorized refund", async () => {
      await expect(escrow.connect(addr1).refund(addr2.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Deposit", () => {
    const testAmounts = ["0", "1", "100", "10000000", "1000000000000000000"];

    for (const amountStr of testAmounts) {
      it(`Should handle deposit of ${amountStr} wei correctly`, async () => {
        await mockERC20.connect(addr1).approve(escrowAddress, amountStr);
        const amount = BigInt(amountStr);
        if (amount === 0n) {
          await expect(escrow.deposit(amountStr))
            .to.be.revertedWith("Zero deposit amount");
        } else {
          const initialBalance = BigInt(await escrow.balance(addr1.address));
          await escrow.connect(addr1).deposit(amountStr);
          const finalBalance = BigInt(await escrow.balance(addr1.address));
          expect(finalBalance).to.equal(initialBalance + amount);
        }
      });
    }
  });
});
