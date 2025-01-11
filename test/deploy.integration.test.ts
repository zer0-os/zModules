import * as hre from "hardhat";
import { getVoting20DeployConfig } from "../src/deploy/missions/voting-erc20/voting20.config";
import { runZModulesCampaign } from "../src/deploy";
import { getBaseZModulesConfig } from "../src/deploy/campaign/get-campaign-config";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getVotingERC20Mission } from "../src/deploy/missions/voting-erc20/voting20.mission";
import { getStakingERC20Mission } from "../src/deploy/missions/staking-erc20/staking20.mission";
import { getStaking20DeployConfig } from "../src/deploy/missions/staking-erc20/staking20.config";
import { IZModulesConfig } from "../src/deploy/campaign/types";
import { getMockERC20Mission, TokenTypes } from "../src/deploy/missions/mocks/mockERC20.mission";
import { getVoting721DeployConfig } from "../src/deploy/missions/voting-erc721/voting721.config";


describe("zModules Deploy Integration Test", () => {
  let deployAdmin : SignerWithAddress;
  let votingTokenAdmin : SignerWithAddress;
  let stakingContractOwner : SignerWithAddress;


  before(async () => {
    [ deployAdmin, votingTokenAdmin, stakingContractOwner ] = await hre.ethers.getSigners();
  });

  describe("Staking", () => {
    it("Should deploy StakingERC20 with zDC and default config", async () => {
      const baseConfig = await getBaseZModulesConfig({
        deployAdmin,
      });

      const votingConfig = getVoting20DeployConfig({
        tokenAdmin: votingTokenAdmin,
      });

      const stakingConfig = getStaking20DeployConfig({
        contractOwner: stakingContractOwner,
      });

      const config : IZModulesConfig = {
        ...baseConfig,
        votingERC20Config: votingConfig,
        stakingERC20Config: stakingConfig,
      };

      const campaign = await runZModulesCampaign({
        config,
        missions: [
          getMockERC20Mission({
            tokenType: TokenTypes.staking,
            tokenName: "Staking Token",
            tokenSymbol: "STK",
          }),
          getMockERC20Mission({
            tokenType: TokenTypes.rewards,
            tokenName: "Rewards Token",
            tokenSymbol: "RWD",
          }),
          getVotingERC20Mission(),
          getStakingERC20Mission(),
        ],
      });

      // TODO dep: check all state vars on all contracts, but mocks after deploy against env variables
      //     against all incoming values (from test or ENV, based on where they came from)
    });

    it("Should deploy StakingERC721 with zDC and default config", async () => {
      const baseConfig = await getBaseZModulesConfig({
        deployAdmin,
      });

      const votingConfig = getVoting721DeployConfig({
        tokenAdmin: votingTokenAdmin,
      });

      const stakingConfig = getStaking20DeployConfig({
        contractOwner: stakingContractOwner,
      });

      const config : IZModulesConfig = {
        ...baseConfig,
        votingERC20Config: votingConfig,
        stakingERC20Config: stakingConfig,
      };

      const campaign = await runZModulesCampaign({
        config,
        missions: [
          getMockERC20Mission({
            tokenType: TokenTypes.staking,
            tokenName: "Staking Token",
            tokenSymbol: "STK",
          }),
          getMockERC20Mission({
            tokenType: TokenTypes.rewards,
            tokenName: "Rewards Token",
            tokenSymbol: "RWD",
          }),
          getVotingERC20Mission(),
          getStakingERC20Mission(),
        ],
      });
    });

    // TODO dep: add test and logic for staking deploy with gas token !!!
  });
});
