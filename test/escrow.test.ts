import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { Escrow } from "../typechain"; // Adjust the import path according to your project structure
import { ERC20TestToken } from "../typechain"; // Adjust assuming you have a mock ERC20 for testing
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Escrow Contract", function () {
    let mockERC20: ERC20TestToken;
    let escrow: Escrow;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;

    before(async function () {
        const signers: SignerWithAddress[] = await hre.ethers.getSigners();
        owner = signers[0];
        addr1 = signers[1];
        addr2 = signers[2];

        const MockERC20Factory = await hre.ethers.getContractFactory("ERC20TestToken");
        mockERC20 = (await MockERC20Factory.deploy("MockToken", "MTK")) as ERC20TestToken;

        const escrowFactory = await hre.ethers.getContractFactory("Escrow");
        escrow = (await escrowFactory.deploy(await mockERC20.getAddress(), await owner.getAddress())) as Escrow;

        // Mint some tokens to test accounts
        await mockERC20.mint(addr1.address, ethers.parseEther("1000"));
        await mockERC20.mint(addr2.address, ethers.parseEther("500"));
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
        it("Should allow deposits", async function () {
            const depositAmount = ethers.parseEther("100");
            await mockERC20.connect(addr1).approve(await escrow.getAddress(), depositAmount);
            await escrow.connect(addr1).deposit(depositAmount);

            expect(await escrow.getBalance(addr1.address)).to.equal(depositAmount);
        });

        it("Should execute payments", async function () {
            const paymentAmount = ethers.parseEther("50");
            await escrow.connect(owner).executePayment(addr1.address, paymentAmount);

            const finalBalance = await escrow.getBalance(addr1.address);
            expect(finalBalance).to.equal(ethers.parseEther("50"));
            expect(await mockERC20.balanceOf(addr1.address)).to.equal(ethers.parseEther("950"));
        });

        it("Should handle refunds correctly", async function () {
            await escrow.connect(owner).refund(addr1.address);

            expect(await escrow.getBalance(addr1.address)).to.equal(ethers.parseEther("0"));
            expect(await mockERC20.balanceOf(addr1.address)).to.equal(ethers.parseEther("1000"));
        });
    });
    describe("Negative Tests", function () {
        it("Should fail for insufficient balance on payment", async function () {
            const excessiveAmount = ethers.parseEther("1100"); // More than addr1's balance
            await expect(escrow.connect(owner).executePayment(addr1.address, excessiveAmount))
                .to.be.revertedWith("Insufficient balance"); // Adjust error message based on your contract's requirements
        });

        it("Should fail for unauthorized payment execution", async function () {
            const paymentAmount = ethers.parseEther("10");
            await expect(escrow.connect(addr1).executePayment(addr2.address, paymentAmount))
                .to.be.revertedWith("Caller is not the owner"); // Adjust error message based on your contract's requirements
        });

        it("Should fail for unauthorized refund", async function () {
            await expect(escrow.connect(addr1).refund(addr2.address))
                .to.be.revertedWith("Caller is not the owner"); // Adjust error message based on your contract's requirements
        });
    });
});