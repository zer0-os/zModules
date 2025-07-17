import { getBaseZModulesConfig } from "../campaign/base-campaign-config";
import * as hre from "hardhat";
import { ZModulesRewardsVaultDM } from "../missions/rewards-vault/rewards-vault.mission";
import { runZModulesCampaign } from "../campaign/campaign";
import { getRewardsVaultConfig } from "../missions/rewards-vault/rewards-vault.config";
import { IZModulesConfig } from "../campaign/types";


const deployRewardsVault = async () => {
  const [ deployAdmin ] = await hre.ethers.getSigners();

  const baseConfig = await getBaseZModulesConfig({ deployAdmin });

  const config = {
    ...baseConfig,
    rewardsVaultConfig: getRewardsVaultConfig(),
  } as IZModulesConfig;

  // eslint-disable-next-line no-return-await
  return await runZModulesCampaign({
    config,
    missions: [
      ZModulesRewardsVaultDM,
    ],
  });
};


deployRewardsVault()
  .then(() => {
    console.log("Deployment: Rewards Vault deployed successfully!");
  })
  .catch(error => {
    console.error("Deployment: Error deploying Rewards Vault:", error);
    process.exit(1);
  });
