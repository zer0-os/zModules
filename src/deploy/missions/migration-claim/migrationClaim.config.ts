import assert from "assert";
import { IZModulesConfig } from "../../campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { EnvironmentLevels } from "@zero-tech/zdc";
import { ZeroHash } from "ethers";
import * as hre from "hardhat";
import { LP_TOKEN_ADDRESS, WILD_TOKEN_ADDRESS } from "./constants";
import { getBaseZModulesConfig } from "../../campaign/base-campaign-config";


export interface MigrationClaimConfigArgs {
  owner : SignerWithAddress;
  deployAdmin : SignerWithAddress;
  merkleRoot ?: string;
  rewardsVault ?: string;
  wildToken ?: string;
  lpToken ?: string;
}

export const getMigrationClaimDeployConfig = async ({
  owner,
  deployAdmin,
  merkleRoot,
  rewardsVault,
  wildToken,
  lpToken,
} : MigrationClaimConfigArgs) : Promise<IZModulesConfig> => {

  owner = owner ?? process.env.MIGRATION_CLAIM_CONTRACT_OWNER;
  deployAdmin = deployAdmin ?? process.env.MIGRATION_CLAIM_CONTRACT_DEPLOYER;
  rewardsVault = rewardsVault ?? process.env.MIGRATION_CLAIM_REWARDS_VAULT;

  merkleRoot = merkleRoot ?? ZeroHash;
  wildToken = wildToken ?? WILD_TOKEN_ADDRESS;
  lpToken = lpToken ?? LP_TOKEN_ADDRESS;

  const env = process.env.ENV_LEVEL;

  if (env === EnvironmentLevels.prod) {
    assert.ok(
      owner,
      "Missing contract owner for MigrationClaim! Is 'MIGRATION_CLAIM_CONTRACT_OWNER' set?"
    );
    assert.ok(
      rewardsVault,
      "Missing rewards vault address for MigrationClaim! Is 'MIGRATION_CLAIM_REWARDS_VAULT' set?"
    );
  } else {
    throw new Error("Invalid environment level!");
  }

  const baseConfig = await getBaseZModulesConfig({ deployAdmin });

  const config = {
    ...baseConfig,
    migrationClaimConfig: {
      merkleRoot,
      owner: owner.address,
      rewardsVault,
      wildToken,
      lpToken,
    },
  } as IZModulesConfig;

  return config;
};
