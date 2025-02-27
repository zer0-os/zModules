/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import assert from "assert";
import { findMissingEnvVars } from "../../environment/validate";
import { EnvironmentLevels, IDeployCampaignConfig } from "@zero-tech/zdc";


export const getBaseZModulesConfig = async ({
  deployAdmin,
} : {
  deployAdmin ?: SignerWithAddress;
} = {}) : Promise<IDeployCampaignConfig<SignerWithAddress>> => {
  if (!deployAdmin) [ deployAdmin ] = await hre.ethers.getSigners();

  validateEnv(process.env.ENV_LEVEL);

  return {
    env: process.env.ENV_LEVEL,
    deployAdmin,
    confirmationsN: Number(process.env.CONFIRMATIONS_N),
    srcChainName: process.env.SRC_CHAIN_NAME,
    mockTokens: process.env.MOCK_TOKENS === "true",
    postDeploy : {
      tenderlyProjectSlug: process.env.TENDERLY_PROJECT_SLUG!,
      monitorContracts: process.env.MONITOR_CONTRACTS === "true",
      verifyContracts: process.env.VERIFY_CONTRACTS === "true",
    },
  };
};

export const validateEnv = (env : string) =>  {
  findMissingEnvVars();

  assert.ok(
    env === EnvironmentLevels.dev || env === EnvironmentLevels.test || env === EnvironmentLevels.prod,
    "Provide correct ENV_LEVEL (dev / test / prod)"
  );

  if (env !== EnvironmentLevels.dev)
    assert.ok(
      !process.env.MONGO_DB_URI.includes("localhost"),
      "Cannot use local mongo URI in 'prod' or 'test' environment!"
    );

  if (process.env.MONITOR_CONTRACTS === "true") {
    assert.ok(!!process.env.TENDERLY_PROJECT_SLUG, "Must provide a Tenderly Project Slug to monitor contracts");
    assert.ok(!!process.env.TENDERLY_ACCOUNT_ID, "Must provide a Tenderly Account ID to monitor contracts");
    assert.ok(!!process.env.TENDERLY_ACCESS_KEY, "Must provide a Tenderly Access Key to monitor contracts");
  }
};
