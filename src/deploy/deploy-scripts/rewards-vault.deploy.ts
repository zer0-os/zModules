import { getBaseZModulesConfig } from "../campaign/base-campaign-config";
import * as hre from "hardhat";
import { ZModulesRewardsVaultDM } from "../missions/rewards-vault/rewards-vault.mission";
import { runZModulesCampaign } from "../campaign/campaign";
import { getRewardsVaultConfig } from "../missions/rewards-vault/rewards-vault.config";
import { IZModulesConfig } from "../campaign/types";


const deployRewardsVault = async () => {

  const deployAdmin = await hre.ethers.getSigner(
    process.env.REWARDS_VAULT_OWNER
  );

  if (!process.env.REWARDS_VAULT_TOKEN) {
  // deploy MockERC20 as a token for Rewards Vault if not provided
    const mockTokenFactory = await hre.ethers.getContractFactory("MockERC20");
    const mockToken = await mockTokenFactory.connect(deployAdmin).deploy(
      "Rewards Token",
      "RWD",
    );
    await mockToken.waitForDeployment();

    process.env.REWARDS_VAULT_TOKEN = mockToken.target as string;
  }

  const baseConfig = await getBaseZModulesConfig({ deployAdmin });

  const config = {
    ...baseConfig,
    rewardsVaultConfig: getRewardsVaultConfig(),
  } as IZModulesConfig;

  const campaign = await runZModulesCampaign({
    config,
    missions: [
      ZModulesRewardsVaultDM,
    ],
  });

  const {
    zeroRewardsVault,
    dbAdapter,
  } = campaign;
};

const deployWithoutCampaign = async () => {
  const deployAdmin = new hre.ethers.Wallet(
    process.env.TESTNET_PRIVATE_KEY_A!,
    hre.ethers.provider
  );

  const factory = await hre.ethers.getContractFactory("ZeroRewardsVault");
  const rewardsVaultTX = await factory.connect(deployAdmin).deploy(
    process.env.REWARDS_VAULT_OWNER,
    process.env.REWARDS_VAULT_TOKEN,
  );
  await rewardsVaultTX.waitForDeployment();

  console.log("Rewards Vault deployed at:", rewardsVaultTX.target);
};

deployRewardsVault()
  .then(() => {
    console.log("Deployment: Rewards Vault deployed successfully!");
  })
  .catch(error => {
    console.error("Deployment: Error deploying Rewards Vault:", error);
    process.exit(1);
  });