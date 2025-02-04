/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as hre from "hardhat";
import {
  IZModulesConfig,
} from "./types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import assert from "assert";
import { findMissingEnvVars } from "../../environment/validate";
import { getStaking20DeployConfig } from "../missions/staking-erc20/staking20.config";
import { getVoting721DeployConfig } from "../missions/voting-erc721/voting721.config";
import { getStaking721DeployConfig } from "../missions/staking-erc721/staking721.config";
import { getMatchDeployConfig } from "../missions/match/match.config";
import { getVoting20DeployConfig } from "../missions/voting-erc20/voting20.config";
import { IDeployCampaignConfig } from "@zero-tech/zdc";
import { getDAOConfig } from "../missions/dao/zdao.config";

// TODO dep: create a function that builds config for any configuration of contracts/missions
//   and calls individual config getters based on the missions passed
//   once all individual module deploys and tests are ready and tested

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

export const getCampaignConfig = ({
  deployAdmin,
  mockTokens,
  postDeploy,
} : {
  deployAdmin : SignerWithAddress;
  mockTokens ?: boolean;
  postDeploy ?: {
    tenderlyProjectSlug : string;
    monitorContracts : boolean;
    verifyContracts : boolean;
  };
}) => {
  const envLevel = process.env.ENV_LEVEL;

  validateEnv(envLevel);

  const mockTokensFinal = mockTokens || process.env.MOCK_TOKENS === "true";

  const stk20Conf = getStaking20DeployConfig({
    contractOwner: deployAdmin,
  });
  const stk721Conf = getStaking721DeployConfig({
    contractOwner: deployAdmin,
  });
  const matchConf = getMatchDeployConfig({
    mockTokens: mockTokensFinal,
  });
  const voting20Conf = getVoting20DeployConfig({
    tokenAdmin: deployAdmin,
  });
  const voting721Conf = getVoting721DeployConfig({
    tokenAdmin: deployAdmin,
  });
  const daoConf = getDAOConfig();

  const config : IZModulesConfig = {
    env: envLevel,
    deployAdmin,
    stakingERC20Config: stk20Conf,
    stakingERC721Config: stk721Conf,
    matchConfig: matchConf,
    votingERC20Config: voting20Conf,
    votingERC721Config: voting721Conf,
    mockTokens: mockTokensFinal,
    postDeploy: postDeploy ||
      {
        tenderlyProjectSlug: process.env.TENDERLY_PROJECT_SLUG!,
        monitorContracts: process.env.MONITOR_CONTRACTS === "true",
        verifyContracts: process.env.VERIFY_CONTRACTS === "true",
      },
  };

  return config;
};

export const validateEnv = (env : string) =>  {
  findMissingEnvVars();

  assert.ok(
    env === "dev" || env === "test" || env === "prod",
    "Provide correct ENV_LEVEL (dev / test / prod)"
  );

  if (env !== "dev")
    assert.ok(
      !process.env.MONGO_DB_URI.includes("localhost"),
      "Cannot use local mongo URI in 'prod' or 'test' environment!"
    );

  if (process.env.VERIFY_CONTRACTS === "true") {
    assert.ok(!!process.env.ETHERSCAN_API_KEY, "Must provide an Etherscan API Key to verify contracts");
  }

  if (process.env.MONITOR_CONTRACTS === "true") {
    assert.ok(!!process.env.TENDERLY_PROJECT_SLUG, "Must provide a Tenderly Project Slug to monitor contracts");
    assert.ok(!!process.env.TENDERLY_ACCOUNT_ID, "Must provide a Tenderly Account ID to monitor contracts");
    assert.ok(!!process.env.TENDERLY_ACCESS_KEY, "Must provide a Tenderly Access Key to monitor contracts");
  }
};
