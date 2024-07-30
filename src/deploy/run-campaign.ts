import { getCampaignConfig } from "./campaign/environment";
import { getLogger } from "@zero-tech/zdc";
import * as hre from "hardhat";
import { runZModulesCampaign } from "./campaign/campaign";
import { getStakingERC20Mission } from "./missions/stakingERC20.mission";
import { getStakingERC721Mission } from "./missions/stakingERC721Mission";
import { ZModulesMatchDM } from "./missions/match.mission";
import { IZModulesConfig } from "./campaign/types.campaign";
import { getMockERC20Mission, TokenTypes } from "./missions/mockERC20.mission";
import { getMockERC721Mission } from "./missions/mockERC721.mission";


const logger = getLogger();

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
    mockTokens,
  } = config;

  const missions = [];

  if (!!stakingERC20Config) {
    if (mockTokens) {
      missions.push(getMockERC20Mission({ tokenType: TokenTypes.staking }));
      missions.push(getMockERC20Mission({ tokenType: TokenTypes.rewards }));
    }

    missions.push(getStakingERC20Mission());
  }

  if (!!stakingERC721Config) {
    if (mockTokens) {
      missions.push(getMockERC721Mission());
    }

    missions.push(getStakingERC721Mission());
  }

  if (!!matchConfig) {
    if (mockTokens) {
      missions.push(getMockERC20Mission({ tokenType: TokenTypes.general }));
    }

    missions.push(ZModulesMatchDM);
  }

  return missions;
};


runCampaign()
  .catch(error => {
    logger.error(error.stack);
    process.exit(1);
  }).finally(() => {
    process.exit(0);
  });
