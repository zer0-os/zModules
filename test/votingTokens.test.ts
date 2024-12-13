import { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BURNER_ROLE,
  DEFAULT_ADMIN_ROLE,
  MINTER_ROLE,
} from "./helpers/voting/constants";
import { ZeroVotingERC20, ZeroVotingERC721 } from "../typechain";


describe("Voting tokens tests", () => {
  let owner : HardhatEthersSigner;
  let addr1 : HardhatEthersSigner;
  let addr2 : HardhatEthersSigner;

  let erc20Token : ZeroVotingERC20;
  let erc721Token : ZeroVotingERC721;

  const erc20Name = "ZeroVotingERC20";
  const erc20Symbol = "ZV";

  const erc721Name = "ZeroVotingERC721";
  const erc721Symbol = "ZVNFT";

  const mintAmount = ethers.parseEther("150");
  const burnAmount = ethers.parseEther("100");
  const transferAmount = ethers.parseEther("50");
  const tokenId = 1;


  before(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    // ERC20 deploy
    const ERC20Factory = await ethers.getContractFactory(erc20Name);
    erc20Token = await ERC20Factory.connect(owner).deploy(erc20Name, erc20Symbol, owner);
    await erc20Token.waitForDeployment();

    // mint erc20 tokens to users and owner
    await erc20Token.connect(owner).mint(owner.address, ethers.parseEther("1000"));
    await erc20Token.connect(owner).transfer(addr1.address, ethers.parseEther("100"));
    await erc20Token.connect(owner).transfer(addr2.address, ethers.parseEther("50"));

    // ERC721 deploy
    const ERC721Factory = await ethers.getContractFactory(erc721Name) ;
    erc721Token = await ERC721Factory.connect(owner).deploy(erc721Name, erc721Symbol, "1.0", owner);
    await erc721Token.waitForDeployment();

    // mint 10 NFTs to owner
    for (let i = 0; i < 10; i++) {
      await erc721Token.connect(owner).mint(owner.address, tokenId + i);
    }
  });

  describe("ZeroVotingERC20", () => {
    it("Should correctly set name and symbol for ERC20 token", async () => {
      expect(await erc20Token.name()).to.equal(erc20Name);
      expect(await erc20Token.symbol()).to.equal(erc20Symbol);
    });

    describe("Voting functions", () => {
      it("Should delegate votes for ERC20 token", async () => {
        const balanceBefore = await erc20Token.balanceOf(owner.address);

        await erc20Token.connect(owner).delegate(owner.address);
        const votes = await erc20Token.getVotes(owner.address);

        expect(
          balanceBefore
        ).not.eq(
          0n
        );

        expect(
          votes
        ).to.eq(
          balanceBefore
        );
      });

      it("Should correctly update votes after TRANSFER for ERC20 token", async () => {
        const balanceBefore = await erc20Token.balanceOf(addr1.address);
        await erc20Token.connect(addr1).delegate(addr1.address);
        const votesBefore = await erc20Token.getVotes(addr1.address);

        expect(
          votesBefore
        ).to.equal(
          balanceBefore
        );

        await erc20Token.connect(addr1).transfer(addr2.address, transferAmount);
        const votesAfterTransfer = await erc20Token.getVotes(addr1.address);

        expect(
          votesAfterTransfer
        ).to.equal(
          balanceBefore - transferAmount
        );
      });

      it("Should correctly update votes after BURN for ERC20 token", async () => {
        await erc20Token.connect(owner).mint(addr1.address, mintAmount);
        const balanceBefore = await erc20Token.balanceOf(addr1.address);

        await erc20Token.connect(owner).burn(addr1.address, burnAmount);

        const votesAfterBurn = await erc20Token.getVotes(addr1.address);

        expect(
          votesAfterBurn
        ).to.equal(
          balanceBefore - burnAmount
        );
      });
    });

    describe("Access control", () => {
      it("Should revert when NON-ADMIN grants role", async () => {
        await expect(
          erc20Token.connect(addr2).grantRole(DEFAULT_ADMIN_ROLE, addr1.address)
        ).to.be.revertedWithCustomError(
          erc20Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr2.address,
          DEFAULT_ADMIN_ROLE
        );
      });

      it("Should revert when NON-ADMIN calls #revokeRole", async () => {
        await expect(
          erc20Token.connect(addr2).revokeRole(DEFAULT_ADMIN_ROLE, addr1.address)
        ).to.be.revertedWithCustomError(
          erc20Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr2.address,
          DEFAULT_ADMIN_ROLE
        );
      });

      it("Should revert when NON-MINTER mints tokens", async () => {
        await expect(
          erc20Token.connect(addr2).mint(addr1.address, 2000)
        ).to.be.revertedWithCustomError(
          erc20Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr2.address,
          MINTER_ROLE
        );
      });

      it("Should revert when NON-BURNER burns tokens", async () => {
        await expect(
          erc20Token.connect(addr1).burn(addr1, 2000)
        ).to.be.revertedWithCustomError(
          erc20Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr1.address,
          BURNER_ROLE
        );
      });

      // POSITIVE
      it("The DEFAULT_ADMIN should be allowed to perform the #grantRole", async () => {
      // grant addr2 admin_role for next test
        const admins = [addr1.address, addr2.address];

        for (const newAdmin of admins) {
          await expect(
            erc20Token.connect(owner).grantRole(DEFAULT_ADMIN_ROLE, newAdmin)
          ).to.emit(
            erc20Token,
            "RoleGranted"
          ).withArgs(
            DEFAULT_ADMIN_ROLE,
            newAdmin,
            owner.address
          );

          // check event
          expect(
            await erc20Token.hasRole(DEFAULT_ADMIN_ROLE, newAdmin)
          ).to.eq(
            true
          );
        }
      });

      it("Should allow DEFAULT_ADMIN to revoke his role", async () => {
        await expect(
          erc20Token.connect(addr2).revokeRole(DEFAULT_ADMIN_ROLE, addr2.address)
        ).to.emit(
          erc20Token,
          "RoleRevoked"
        ).withArgs(
          DEFAULT_ADMIN_ROLE,
          addr2.address,
          addr2.address
        );

        expect(
          await erc20Token.hasRole(DEFAULT_ADMIN_ROLE, addr2.address)
        ).to.eq(
          false
        );
      });

      // similar test, but called by a different admin
      it("Should allow DEFAULT_ADMIN to revoke the admin role of another admin", async () => {
      // check event
        await expect(
          erc20Token.connect(owner).revokeRole(DEFAULT_ADMIN_ROLE, addr1.address)
        ).to.emit(
          erc20Token,
          "RoleRevoked"
        ).withArgs(
          DEFAULT_ADMIN_ROLE,
          addr1.address,
          owner.address
        );

        expect(
          await erc20Token.hasRole(DEFAULT_ADMIN_ROLE, addr1.address)
        ).to.eq(
          false
        );
      });
    });
  });

  describe("ZeroVotingERC721", () => {
    it("Should correctly set name and symbol for ERC721 token", async () => {
      expect(
        await erc721Token.name()
      ).to.equal(
        erc721Name
      );

      expect(
        await erc721Token.symbol()
      ).to.equal(
        erc721Symbol
      );
    });

    describe("Voting functions", () => {
      it("Should delegate votes for ERC721 token", async () => {
        const balanceBefore = await erc721Token.balanceOf(owner.address);

        await erc721Token.connect(owner).delegate(owner.address);

        const votesAfter = await erc721Token.getVotes(owner.address);

        expect(
          balanceBefore
        ).not.eq(
          0n
        );

        expect(
          votesAfter
        ).to.eq(
          balanceBefore
        );
      });

      it("Should update votes after transferring NFT for ERC721 token", async () => {
        const votesBefore = await erc721Token.getVotes(owner.address);

        await erc721Token.connect(owner).transferFrom(owner.address, addr1.address, tokenId);
        const votesAfter = await erc721Token.getVotes(owner.address);

        expect(
          votesAfter
        ).to.eq(
          votesBefore - 1n
        );
      });

      it("Should correctly update votes after BURN for ERC721 token", async () => {
        const balanceBefore = await erc721Token.balanceOf(owner.address);
        const votesBeforeBurn = await erc721Token.getVotes(owner.address);

        await erc721Token.connect(owner).burn(tokenId + 1);

        const balanceAfter = await erc721Token.balanceOf(owner.address);
        const votesAfterBurn = await erc721Token.getVotes(owner.address);

        expect(
          balanceAfter
        ).to.equal(
          balanceBefore - 1n
        );

        expect(
          votesAfterBurn
        ).to.equal(
          votesBeforeBurn - 1n
        );
      });
    });

    describe("Access control", () => {
      it("Should revert when NON-ADMIN grants role", async () => {
        await expect(
          erc721Token.connect(addr2).grantRole(DEFAULT_ADMIN_ROLE, addr1.address)
        ).to.be.revertedWithCustomError(
          erc721Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr2.address,
          DEFAULT_ADMIN_ROLE
        );
      });

      it("Should revert when NON-ADMIN calls #revokeRole", async () => {
        await expect(
          erc721Token.connect(addr2).revokeRole(DEFAULT_ADMIN_ROLE, addr1.address)
        ).to.be.revertedWithCustomError(
          erc721Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr2.address,
          DEFAULT_ADMIN_ROLE
        );
      });

      it("Should revert when NON-MINTER mints tokens", async () => {
        await expect(
          erc721Token.connect(addr2).mint(addr1.address, "99999")
        ).to.be.revertedWithCustomError(
          erc721Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr2.address,
          MINTER_ROLE
        );
      });

      it("Should revert when NON-BURNER burns tokens", async () => {
        await expect(
          erc721Token.connect(addr1).burn(3)
        ).to.be.revertedWithCustomError(
          erc721Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr1.address,
          BURNER_ROLE
        );
      });

      // POSITIVE
      it("The DEFAULT_ADMIN should be allowed to perform the #grantRole", async () => {
      // grant addr2 admin_role for next test
        const admins = [addr1.address, addr2.address];

        for (const newAdmin of admins) {
          await expect(
            erc721Token.connect(owner).grantRole(DEFAULT_ADMIN_ROLE, newAdmin)
          ).to.emit(
            erc721Token,
            "RoleGranted"
          ).withArgs(
            DEFAULT_ADMIN_ROLE,
            newAdmin,
            owner.address
          );

          // check event
          expect(
            await erc721Token.hasRole(DEFAULT_ADMIN_ROLE, newAdmin)
          ).to.eq(
            true
          );
        }
      });

      it("Should allow revocation of ADMIN_ROLE role to YOURSELF", async () => {
        await expect(
          erc721Token.connect(addr2).revokeRole(DEFAULT_ADMIN_ROLE, addr2.address)
        ).to.emit(
          erc721Token,
          "RoleRevoked"
        ).withArgs(
          DEFAULT_ADMIN_ROLE,
          addr2.address,
          addr2.address
        );

        expect(
          await erc721Token.hasRole(DEFAULT_ADMIN_ROLE, addr2.address)
        ).to.eq(
          false
        );
      });

      it("The DEFAULT_ADMIN should be allowed to perform the #revokeRole", async () => {
      // check event
        await expect(
          erc721Token.revokeRole(DEFAULT_ADMIN_ROLE, addr1.address)
        ).to.emit(
          erc721Token,
          "RoleRevoked"
        ).withArgs(
          DEFAULT_ADMIN_ROLE,
          addr1.address,
          owner.address
        );

        expect(
          await erc721Token.hasRole(DEFAULT_ADMIN_ROLE, addr1.address)
        ).to.eq(
          false
        );
      });
    });
  });
});
