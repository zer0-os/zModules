import { getLogger } from "@zero-tech/zdc";
import * as hre from "hardhat";
import { runZModulesCampaign } from "./campaign/campaign";
import { getCampaignConfig } from "./campaign/get-campaign-config";
import { IZModulesConfig } from "./campaign/types";
import { getMockERC20Mission, TokenTypes } from "./missions/mocks/mockERC20.mission";
import { getStakingERC20Mission } from "./missions/staking-erc20/staking20.mission";
import { getMockERC721Mission } from "./missions/mocks/mockERC721.mission";
import { getStakingERC721Mission } from "./missions/staking-erc721/staking721.mission";
import { getVotingERC20Mission } from "./missions/voting-erc20/voting20.mission";
import { ZModulesMatchDM } from "./missions/match/match.mission";


const runCampaign = async () => {
  const [ deployAdmin ] = await hre.ethers.getSigners();

  const config = getCampaignConfig({
    deployAdmin,
  });

  const missions = getMissionsToDeploy(config);

  return runZModulesCampaign({
    config,
    missions,
  });
};

export const getMissionsToDeploy = (config : IZModulesConfig) => {
  const {
    stakingERC20Config,
    stakingERC721Config,
    matchConfig,
    votingERC20Config,
    votingERC721Config,
  } = config;

  const missions = [];

  if (!!stakingERC20Config) {
    if (stakingERC20Config.mockTokens) {
      missions.push(getMockERC20Mission({ tokenType: TokenTypes.staking }));
      missions.push(getMockERC20Mission({ tokenType: TokenTypes.rewards }));
    }

    missions.push(getStakingERC20Mission());
  }

  if (!!stakingERC721Config) {
    if (stakingERC721Config.mockTokens) {
      missions.push(getMockERC721Mission());
    }

    missions.push(getStakingERC721Mission());
  }

  if (!!votingERC20Config) {
    missions.push(getVotingERC20Mission());
  }

  if (!!votingERC721Config) {
    missions.push(getVotingERC20Mission());
  }

  if (!!matchConfig) {
    if (matchConfig.mockTokens) {
      missions.push(getMockERC20Mission({ tokenType: TokenTypes.general }));
    }

    missions.push(ZModulesMatchDM);
  }

  return missions;
};


runCampaign()
  .catch(error => {
    const logger = getLogger({
      silence: process.env.SILENT_LOGGER === "true",
    });

    logger.error(error.stack);
    process.exit(1);
  }).finally(() => {
    process.exit(0);
  });
