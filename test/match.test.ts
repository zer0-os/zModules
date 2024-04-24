import * as hre from "hardhat";
import { ethers } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Escrow, Match } from "../typechain"; // Adjust the import path according to your project structure
import { ERC20TestToken } from "../typechain"; // Adjust assuming you have a mock ERC20 for testing

describe("Match Contract", function () {
    let mockERC20: ERC20TestToken;
    let match: Match;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let ownerAddress: string;
    let addr1Address: string;
    let addr2Address: string;
    let mockERC20Address: string;
    let matchAddress: string;
    const ownerMintAmount = ethers.parseEther("100000000000000000000");

    before(async function () {
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

        await match.transferOwnership(matchAddress);

        await mockERC20.mint(addr1Address, ethers.parseEther("1000"));
        await mockERC20.mint(addr2Address, ethers.parseEther("500"));
        //await mockERC20.mint(matchAddress, ethers.parseEther("1000000"));
        await mockERC20.mint(owner, ownerMintAmount);
        await mockERC20.connect(owner).increaseAllowance(matchAddress, ownerMintAmount);
    });

    describe("Match Operations", function () {
        it("Should correctly determine if players can match based on match balance", async function () {
            let depositAmount = ethers.parseEther("100");
            await mockERC20.connect(addr1).approve(matchAddress, depositAmount);
            await match.connect(addr1).deposit(depositAmount);

            const canMatchBefore = await match.canMatch([addr1Address, addr2Address], depositAmount);
            expect(canMatchBefore).to.be.false;

            await mockERC20.connect(addr2).approve(matchAddress, depositAmount);
            await match.connect(addr2).deposit(depositAmount);
            const canMatchAfter = await match.canMatch([addr1Address, addr2Address], depositAmount);
            expect(canMatchAfter).to.be.true;
        });

        it("Should pay winners variable amounts and emit Payment event for each", async function () {
            const amounts = [ethers.parseEther("25"), ethers.parseEther("75")];
            const winners = [addr1Address, addr2Address];
            const finalBal1 = ethers.parseEther("175");
            const finalBal2 = ethers.parseEther("225");

            await match.connect(owner).payAllAmounts(amounts, winners);

            // Check final balances
            const addr1FinalBalance = await match.balance(addr1Address);
            const addr2FinalBalance = await match.balance(addr2Address);
            expect(addr1FinalBalance).to.equal(finalBal1);
            expect(addr2FinalBalance).to.equal(finalBal2);
        });
    });

    describe("Negative Tests", function () {
        it("Non-owner cannot call payAllAmounts", async function () {
            await expect(match.connect(addr2).payAllAmounts([ethers.parseEther("10")], [addr2Address]))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("payAllAmounts fails when amounts and winners array lengths do not match", async function () {
            const amounts = [ethers.parseEther("10")];
            const winners = [addr1Address, addr2Address]; // Assuming addr1Address and addr2Address are initialized
            await expect(match.payAllAmounts(amounts, winners))
                .to.be.revertedWith("Amounts and winners length mismatch");
        });


        it("Reverts payAllAmounts with insufficient paymentAccount balance", async function () {
            // Assuming the match balance for addr2Address is less than 50 ether for this example
            const amounts = [ethers.parseEther("50000000000000000000000")];
            const winners = [addr2Address];
            await expect(match.payAllAmounts(amounts, winners))
                .to.be.revertedWith("ERC20: insufficient allowance");
        });
        it("should handle sequential payAllAmounts calls correctly", async function () {
            const balance1Before = await match.balance(addr1Address);
            const balance2Before = await match.balance(addr2Address);
            const paymentAmounts = [ethers.parseEther("1"), ethers.parseEther("9")];
            const winners = [addr1Address, addr2Address];
            await match.payAllAmounts(paymentAmounts, winners);
            await match.payAllAmounts(paymentAmounts, winners);

            const balance1 = await match.balance(addr1Address);
            const balance2 = await match.balance(addr2Address);
            expect(balance1).to.equal(balance1Before + paymentAmounts[0] + paymentAmounts[1]);
            expect(balance2).to.equal(balance2Before + paymentAmounts[0] + paymentAmounts[1]);
        });
    });
});
