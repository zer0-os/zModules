import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { getRewardsVaultConfig } from "../missions/rewards-vault/rewards-vault.config";
import { getBaseZModulesConfig } from "./base-campaign-config";
import { IZModulesConfig } from "./types";

export const rewardsVaultSystemConfig = async (deployAdmin : SignerWithAddress) : Promise<IZModulesConfig> => {
  const baseConfig = await getBaseZModulesConfig({ deployAdmin });
  return {
    ...baseConfig,
    rewardsVaultConfig: getRewardsVaultConfig(),
  };
};