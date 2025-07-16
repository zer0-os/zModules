import * as hre from "hardhat";
import { getStaking721SystemConfig } from "../campaign/staking-system-config";
import { runZModulesCampaign } from "../campaign/campaign";
import { getZModulesLogger } from "../mongo";
import { ZModulesZeroVotingERC721DM } from "../missions/voting-erc721/voting721.mission";
import { ZModulesStakingERC721DM } from "../missions/staking-erc721/staking721.mission";


const deployStakingWithVotingToken = async () => {
  const [ deployAdmin ] = await hre.ethers.getSigners();

  const config = await getStaking721SystemConfig(
    deployAdmin,
  );

  // eslint-disable-next-line no-return-await
  return await runZModulesCampaign({
    config,
    missions: [
      ZModulesZeroVotingERC721DM,
      ZModulesStakingERC721DM,
    ],
  });
};

deployStakingWithVotingToken()
  .then(() => {
    getZModulesLogger().info("Staking with Voting Token deployment completed successfully.");
    process.exit(0);
  })
  .catch(error => {
    getZModulesLogger().error("Error during deployment:", error);
    process.exit(1);
  });
