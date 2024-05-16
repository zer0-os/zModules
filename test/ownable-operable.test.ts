import * as hre from "hardhat";
import { OwnableOperable } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { OWNABLE_UNAUTHORIZED_ERR, ZERO_ADDRESS_ERR } from "./helpers/errors";


describe("OwnableOperable.sol Contract", () => {
  let op : OwnableOperable;

  let owner : SignerWithAddress;
  let user : SignerWithAddress;
  let operator1 : SignerWithAddress;
  let operator2 : SignerWithAddress;
  let operator3 : SignerWithAddress;

  before(async () => {
    [ owner, operator1, operator2, operator3, user ] = await hre.ethers.getSigners();

    const OPFactory = await hre.ethers.getContractFactory("OwnableOperable");
    op = await OPFactory.connect(owner).deploy(owner.address);
  });

  describe("Ownable", () => {
    it("should assign msg.sender as owner", async () => {
      expect(await op.owner()).to.equal(owner.address);
    });

    it("should #transferOwnership() if owner is the caller", async () => {
      await op.connect(owner).transferOwnership(user.address);
      expect(await op.owner()).to.equal(user.address);

      // set back
      await op.connect(user).transferOwnership(owner.address);
    });

    it("should revert when #transferOwnership() is called by non-owner", async () => {
      await expect(
        op.connect(user).transferOwnership(operator1.address)
      ).to.be.revertedWithCustomError(op, OWNABLE_UNAUTHORIZED_ERR)
        .withArgs(user.address);
    });
  });

  describe("Operatable", () => {
    it("should assign an operator if owner is the caller and emit an event", async () => {
      expect(await op.isOperator(operator1.address)).to.be.false;

      const tx = await op.connect(owner).addOperator(operator1.address);
      expect(await op.isOperator(operator1.address)).to.be.true;

      await expect(tx).to.emit(op, "OperatorAdded").withArgs(operator1.address);
    });

    it("should revert when #addOperator() is called by non-owner", async () => {
      await expect(
        op.connect(user).addOperator(operator2.address)
      ).to.be.revertedWithCustomError(op, OWNABLE_UNAUTHORIZED_ERR)
        .withArgs(user.address);
    });

    it("should revert when #addOperators() is called by non-owner", async () => {
      await expect(
        op.connect(user).addOperators([operator2.address, operator3.address])
      ).to.be.revertedWithCustomError(op, OWNABLE_UNAUTHORIZED_ERR)
        .withArgs(user.address);
    });

    it("should revert it zero address is passed as operator", async () => {
      await expect(
        op.connect(owner).addOperator(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(op, ZERO_ADDRESS_ERR);
    });

    it("should remove an operator if owner is the caller and emit an event", async () => {
      expect(await op.isOperator(operator1.address)).to.be.true;

      const tx = await op.connect(owner).removeOperator(operator1.address);
      expect(await op.isOperator(operator1.address)).to.be.false;

      await expect(tx).to.emit(op, "OperatorRemoved").withArgs(operator1.address);
    });

    it("should revert when #removeOperator() is called by non-owner", async () => {
      await expect(
        op.connect(user).removeOperator(operator2.address)
      ).to.be.revertedWithCustomError(op, OWNABLE_UNAUTHORIZED_ERR)
        .withArgs(user.address);
    });

    it("should support multiple operators", async () => {
      expect(await op.isOperator(operator3.address)).to.be.false;
      expect(await op.isOperator(operator2.address)).to.be.false;

      await op.connect(owner).addOperator(operator3.address);
      await op.connect(owner).addOperator(operator2.address);

      expect(await op.isOperator(operator3.address)).to.be.true;
      expect(await op.isOperator(operator2.address)).to.be.true;

      await op.connect(owner).removeOperator(operator3.address);
      expect(await op.isOperator(operator3.address)).to.be.false;
      expect(await op.isOperator(operator2.address)).to.be.true;

      await op.connect(owner).removeOperator(operator2.address);
      expect(await op.isOperator(operator3.address)).to.be.false;
      expect(await op.isOperator(operator2.address)).to.be.false;
    });
  });
});
