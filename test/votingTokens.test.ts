import { ethers } from "hardhat";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BURNER_ROLE,
  DEFAULT_ADMIN_ROLE,
  MINTER_ROLE,
} from "./helpers/voting/constants";
import {
  ERC20__factory,
  ERC721__factory,
  ZeroVotingERC20,
  ZeroVotingERC20__factory,
  ZeroVotingERC721,
} from "../typechain";
import { NON_TRANSFERRABLE_ERR, ZERO_ADDRESS_ERR } from "./helpers/errors";


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
  const tokenId = 1;

  const initialBaseURI = "initialBaseURI";
  const newBaseURI = "the/Best/URI/";

  let ERC20Factory : ZeroVotingERC20__factory;
  let ERC721Factory : ZeroVotingERC721__factory;

  before(async () => {
    ERC20Factory = await ethers.getContractFactory(erc20Name);
    ERC721Factory = await ethers.getContractFactory(erc721Name);

    [owner, addr1, addr2] = await ethers.getSigners();

    // ERC20 deploy
    erc20Token = await ERC20Factory.deploy(
      erc20Name,
      erc20Symbol,
      "ZERO DAO",
      "1.0",
      owner.address
    );
    await erc20Token.waitForDeployment();

    // ERC721 deploy
    erc721Token = await ERC721Factory.deploy(
      erc721Name,
      erc721Symbol,
      initialBaseURI,
      "ZERO DAO",
      "1.0",
      owner.address
    );
    await erc721Token.waitForDeployment();

    // give minter and burner roles to owner
    await erc20Token.connect(owner).grantRole(MINTER_ROLE, owner.address);
    await erc20Token.connect(owner).grantRole(BURNER_ROLE, owner.address);

    await erc721Token.connect(owner).grantRole(MINTER_ROLE, owner.address);
    await erc721Token.connect(owner).grantRole(BURNER_ROLE, owner.address);

    // mint erc20 tokens to users and owner
    await erc20Token.connect(owner).mint(owner.address, ethers.parseEther("1000"));
    await erc20Token.connect(owner).mint(addr1.address, ethers.parseEther("100"));
    await erc20Token.connect(owner).mint(addr2.address, ethers.parseEther("50"));

    // mint 10 NFTs to owner
    for (let i = 0; i < 10; i++) {
      await erc721Token.connect(owner).mint(owner.address, tokenId + i, "");
    }
  });

  describe("ZeroVotingERC20", () => {
    it("Should correctly set name and symbol for ERC20 token", async () => {
      expect(await erc20Token.name()).to.equal(erc20Name);
      expect(await erc20Token.symbol()).to.equal(erc20Symbol);
    });

    it("tokens should NOT be transferrable", async () => {
      await expect(
        erc20Token.connect(owner).transfer(addr1.address, ethers.parseEther("12"))
      ).to.be.revertedWithCustomError(
        erc20Token,
        NON_TRANSFERRABLE_ERR
      );
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

      it("Should correctly update votes after BURN for ERC20 token", async () => {
        await erc20Token.connect(owner).mint(addr1.address, mintAmount);

        await erc20Token.connect(addr1).delegate(addr1.address);
        const votesBeforeBurn = await erc20Token.getVotes(addr1.address);

        await erc20Token.connect(owner).burn(addr1.address, burnAmount);

        const votesAfterBurn = await erc20Token.getVotes(addr1.address);

        expect(
          votesAfterBurn
        ).to.equal(
          votesBeforeBurn - burnAmount
        );
      });
    });

    describe("Access control", () => {
      it("Should assign DEFAULT_ADMIN_ROLE to the provided admin if admin is not address(0)", async () => {
        expect(
          await erc20Token.hasRole(await erc20Token.DEFAULT_ADMIN_ROLE(), owner.address)
        ).to.be.true;
      });

      it("should revert if admin is address(0)", async () => {
        await expect(
          ERC20Factory.deploy(
            erc20Name,
            erc20Symbol,
            "ZERO DAO",
            "1.0",
            ethers.ZeroAddress
          )
        ).to.be.revertedWithCustomError(
          ERC20Factory,
          ZERO_ADDRESS_ERR
        );
      });

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

    it("tokens should NOT be transferrable", async () => {
      await expect(
        erc721Token.connect(owner).transferFrom(owner.address, addr1.address, 1)
      ).to.be.revertedWithCustomError(
        erc721Token,
        NON_TRANSFERRABLE_ERR
      );
    });

    it("Should allow minter to #safeMint a token with proper URI", async () => {
      const newTokenId = "8754";
      const newTokenUri = "/newTokenUri/safeMint/";
      await erc721Token.connect(owner).safeMint(addr1.address, newTokenId, newTokenUri);

      const tokenOwner = await erc721Token.ownerOf(newTokenId);
      expect(
        tokenOwner
      ).to.equal(
        addr1.address
      );

      expect(
        await erc721Token.tokenURI(newTokenId)
      ).to.equal(
        `${initialBaseURI + newTokenUri}`
      );
    });

    it("Should emit Transfer event on #safeMint", async () => {
      const newTokenId = "5421";
      const newTokenUri = "safeMint/event";

      await expect(
        erc721Token.connect(owner).safeMint(owner, newTokenId, newTokenUri)
      ).to.emit(
        erc721Token,
        "Transfer"
      ).withArgs(
        ethers.ZeroAddress,
        owner.address,
        newTokenId
      );
    });

    it("Should allow admin to #setBaseURI", async () => {
      const newBaseURI = "newURI";

      // check current URI
      expect(
        await erc721Token.tokenURI(tokenId)
      ).to.be.eq(
        `${initialBaseURI + tokenId}`
      );

      await erc721Token.connect(owner).setBaseURI(newBaseURI);

      expect(
        await erc721Token.tokenURI(tokenId)
      ).to.equal(
        newBaseURI + tokenId
      );
    });

    it("Should emit BaseURIUpdated event when baseURI is updated", async () => {
      await expect(
        erc721Token.connect(owner).setBaseURI(newBaseURI)
      ).to.emit(
        erc721Token,
        "BaseURIUpdated"
      ).withArgs(
        newBaseURI
      );
    });

    it("Should decrement total supply after #burn() and increment after #safeMint()", async () => {
      const totalSupplyInitial = await erc721Token.totalSupply();
      const newTokenId = "3492342";
      await erc721Token.connect(owner).safeMint(owner.address, newTokenId, "");

      const totalSupplyAfterMint = await erc721Token.totalSupply();
      expect(totalSupplyAfterMint).to.equal(totalSupplyInitial + 1n);

      await erc721Token.connect(owner).burn(newTokenId);

      const totalSupplyAfterBurn = await erc721Token.totalSupply();

      expect(
        totalSupplyAfterBurn
      ).to.equal(
        totalSupplyAfterMint - 1n
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
      it("Should assign DEFAULT_ADMIN_ROLE to the provided admin if admin is not address(0)", async () => {
        expect(
          await erc721Token.hasRole(await erc20Token.DEFAULT_ADMIN_ROLE(), owner.address)
        ).to.be.true;
      });

      it("should revert if admin is address(0)", async () => {
        await expect(
          ERC721Factory.deploy(
            erc721Name,
            erc721Symbol,
            initialBaseURI,
            "ZERO DAO",
            "1.0",
            ethers.ZeroAddress
          )
        ).to.be.revertedWithCustomError(
          ERC721Factory,
          ZERO_ADDRESS_ERR
        );
      });

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
          erc721Token.connect(addr2).mint(addr1.address, "99999", "")
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

      it("Should revert, if NON-MINTER tries to #safeMint", async () => {
        expect(
          await erc721Token.hasRole(MINTER_ROLE, addr2.address)
        ).to.be.eq(
          false
        );

        await expect(
          erc721Token.connect(addr2).safeMint(addr1.address, "123456789", "")
        ).to.be.revertedWithCustomError(
          erc721Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr2.address,
          MINTER_ROLE
        );
      });

      it("Should NOT allow NON-ADMIN to #setBaseURI", async () => {
        const unauthorizedBaseURI = "unauthorizedBaseURI";

        expect(
          await erc721Token.hasRole(DEFAULT_ADMIN_ROLE, addr1.address)
        ).to.be.eq(
          false
        );

        await expect(
          erc721Token.connect(addr1).setBaseURI(unauthorizedBaseURI)
        ).to.be.revertedWithCustomError(
          erc721Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr1.address,
          DEFAULT_ADMIN_ROLE
        );

        const currentBaseURI = await erc721Token.tokenURI(tokenId);
        expect(
          currentBaseURI
        ).to.be.eq(
          `${newBaseURI + tokenId}`
        );
      });

      it("Should not allow non-admin to set token URI", async () => {
        const newTokenUri = "/newNFT/";
        const id = "7777777";

        expect(
          await erc721Token.hasRole(DEFAULT_ADMIN_ROLE, addr2.address)
        ).to.be.eq(
          false
        );

        await erc721Token.safeMint(
          addr1.address,
          id,
          "/example.com/"
        );

        await expect(
          erc721Token.connect(addr2).setTokenURI(id, newTokenUri)
        ).to.be.revertedWithCustomError(
          erc721Token,
          "AccessControlUnauthorizedAccount",
        ).withArgs(
          addr2.address,
          DEFAULT_ADMIN_ROLE
        );

        const tokenUri = await erc721Token.tokenURI(id);
        expect(
          tokenUri
        ).to.not.equal(
          newTokenUri
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

      it("Should allow admin to set token URI", async () => {
        const newTokenUri = "https://nft";
        const newTokenId = "122333444455555";

        await erc721Token.safeMint(
          addr1.address,
          newTokenId,
          "/old/URI"
        );

        await erc721Token.connect(owner).setTokenURI(newTokenId, newTokenUri);

        expect(
          await erc721Token.tokenURI(newTokenId)
        ).to.equal(
          `${newBaseURI + newTokenUri}`
        );
      });
    });
  });
});
