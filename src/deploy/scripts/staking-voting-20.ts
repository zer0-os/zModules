import * as hre from "hardhat";
import { getStaking20SystemConfig } from "../campaign/staking-system-config";
import { runZModulesCampaign } from "../campaign/campaign";
import { ZModulesZeroVotingERC20DM } from "../missions/voting-erc20/voting20.mission";
import { ZModulesStakingERC20DM } from "../missions/staking-erc20/staking20.mission";
import { getZModulesLogger } from "../mongo";


const deployStakingWithVotingToken = async () => {
  const [ deployAdmin ] = await hre.ethers.getSigners();

  const config = await getStaking20SystemConfig(
    // !!! Admins here have to be manually set in this function to fine tune who admins what.
    deployAdmin,
  );

  // eslint-disable-next-line no-return-await
  return await runZModulesCampaign({
    config,
    missions: [
      ZModulesZeroVotingERC20DM,
      ZModulesStakingERC20DM,
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
