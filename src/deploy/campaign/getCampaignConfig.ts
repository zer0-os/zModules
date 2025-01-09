/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  IMatchDeployArgs,
  IStakingERC20DeployArgs,
  IStakingERC721DeployArgs,
  IVotingERC20DeployArgs,
  IVotingERC721DeployArgs,
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


export const getCampaignConfig = ({
  env,
  deployAdmin,
  stk20Config,
  stk721Config,
  matchConfig,
  votingERC20Config,
  votingERC721Config,
  mockTokens,
  postDeploy,
} : {
  env ?: string;
  deployAdmin : SignerWithAddress;
  stk20Config ?: IStakingERC20DeployArgs;
  stk721Config ?: IStakingERC721DeployArgs;
  matchConfig ?: IMatchDeployArgs;
  votingERC20Config ?: IVotingERC20DeployArgs;
  votingERC721Config ?: IVotingERC721DeployArgs;
  mockTokens ?: boolean;
  postDeploy ?: {
    tenderlyProjectSlug : string;
    monitorContracts : boolean;
    verifyContracts : boolean;
  };
}) => {
  let envLevel = process.env.ENV_LEVEL;
  if (env) {
    envLevel = env;
  }

  validateEnv(envLevel);

  const mockTokensFinal = mockTokens || process.env.MOCK_TOKENS === "true";

  const stk20Conf = getStaking20DeployConfig(
    envLevel,
    mockTokensFinal,
    stk20Config
  );
  const stk721Conf = getStaking721DeployConfig(
    envLevel,
    mockTokensFinal,
    stk721Config
  );
  const matchConf = getMatchDeployConfig(
    envLevel,
    mockTokensFinal,
    matchConfig
  );
  const voting20Conf = getVoting20DeployConfig(
    votingERC20Config
  );
  const voting721Conf = getVoting721DeployConfig(
    votingERC721Config
  );

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
    env !== "dev" && env !== "test" && env !== "prod",
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
