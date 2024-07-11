/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { IERC20DeployArgs, IERC721DeployArgs, IMatchDeployArgs, IZModulesConfig } from "./types.campaign";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import assert from "assert";


export const getCampaignConfig = ({
  env,
  deployAdmin,
  stk20Config,
  stk721Config,
  matchConfig,
  mockTokens,
  postDeploy,
} : {
  env ?: string;
  deployAdmin : SignerWithAddress;
  stk20Config ?: IERC20DeployArgs;
  stk721Config ?: IERC721DeployArgs;
  matchConfig ?: IMatchDeployArgs;
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

  if (!envLevel) throw new Error("Must provide ENV_LEVEL!");

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

  const config : IZModulesConfig = {
    env: envLevel,
    deployAdmin,
    stakingERC20Config: stk20Conf,
    stakingERC721Config: stk721Conf,
    matchConfig: matchConf,
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

export const getStaking20DeployConfig = (
  env : string,
  mockTokens : boolean,
  config ?: IERC20DeployArgs
) : IERC20DeployArgs | undefined => {
  let configReturn;
  if (env === "dev") {
    configReturn = config;
  } else {
    if (
      !process.env.STAKING20_STAKING_TOKEN ||
      !process.env.STAKING20_REWARDS_TOKEN ||
      !process.env.STAKING20_REWARDS_PER_PERIOD ||
      !process.env.STAKING20_PERIOD_LENGTH ||
      !process.env.STAKING20_TIMELOCK_PERIOD ||
      !process.env.STAKING20_CONTRACT_OWNER
    ) {
      throw new Error("Missing required env variables for StakingERC20!");
    }

    configReturn = {
      stakingToken: process.env.STAKING20_STAKING_TOKEN,
      rewardsToken: process.env.STAKING20_REWARDS_TOKEN,
      rewardsPerPeriod: BigInt(process.env.STAKING20_REWARDS_PER_PERIOD),
      periodLength: BigInt(process.env.STAKING20_PERIOD_LENGTH),
      timeLockPeriod: BigInt(process.env.STAKING20_TIMELOCK_PERIOD),
      contractOwner: process.env.STAKING20_CONTRACT_OWNER,
    };
  }

  if (env === "dev" || env === "test") {
    if (!mockTokens) {
      assert.ok(
        !!configReturn?.stakingToken && !!configReturn?.rewardsToken,
        "Must provide token addresses for StakingERC20 when not mocking!"
      );
    }
  } else {
    assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
  }

  return configReturn;
};

export const getStaking721DeployConfig = (
  env : string,
  mockTokens : boolean,
  config ?: IERC721DeployArgs
) : IERC721DeployArgs | undefined => {
  let configReturn;
  if (env === "dev") {
    configReturn = config;
  } else {
    if (
      !process.env.STAKING721_TOKEN_NAME ||
      !process.env.STAKING721_TOKEN_SYMBOL ||
      !process.env.STAKING721_BASE_URI ||
      !process.env.STAKING721_STAKING_TOKEN ||
      !process.env.STAKING721_REWARDS_TOKEN ||
      !process.env.STAKING721_REWARDS_PER_PERIOD ||
      !process.env.STAKING721_PERIOD_LENGTH ||
      !process.env.STAKING721_TIMELOCK_PERIOD ||
      !process.env.STAKING721_CONTRACT_OWNER
    ) {
      throw new Error("Missing required env variables for StakingERC721!");
    }

    configReturn = {
      name: process.env.STAKING721_TOKEN_NAME,
      symbol: process.env.STAKING721_TOKEN_SYMBOL,
      baseUri: process.env.STAKING721_BASE_URI,
      stakingToken: process.env.STAKING721_STAKING_TOKEN,
      rewardsToken: process.env.STAKING721_REWARDS_TOKEN,
      rewardsPerPeriod: BigInt(process.env.STAKING721_REWARDS_PER_PERIOD),
      periodLength: BigInt(process.env.STAKING721_PERIOD_LENGTH),
      timeLockPeriod: BigInt(process.env.STAKING721_TIMELOCK_PERIOD),
      contractOwner: process.env.STAKING721_CONTRACT_OWNER,
    };
  }

  if (env === "dev" || env === "test") {
    if (!mockTokens) {
      assert.ok(
        !!configReturn?.stakingToken && !!configReturn?.rewardsToken,
        "Must provide token addresses for StakingERC721 when not mocking!"
      );
    }
  } else {
    assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
  }

  return configReturn;
};

export const getMatchDeployConfig = (
  env : string,
  mockTokens : boolean,
  config ?: IMatchDeployArgs
) : IMatchDeployArgs | undefined => {
  let configReturn;
  if (env === "dev") {
    configReturn = config;
  } else {
    if (
      !process.env.MATCH_PAYMENT_TOKEN ||
      !process.env.MATCH_FEE_VAULT_ADDRESS ||
      !process.env.MATCH_OPERATOR_ADDRESSES ||
      !process.env.MATCH_GAME_FEE_PERCENTAGE ||
      !process.env.MATCH_CONTRACT_OWNER_ADDRESS
    ) {
      throw new Error("Missing required env variables for Match!");
    }

    const decoded = atob(process.env.MATCH_OPERATOR_ADDRESSES);
    let operators = [decoded];
    if (decoded.includes(",")) {
      operators = decoded.split(",");
    }

    configReturn = {
      token: process.env.MATCH_PAYMENT_TOKEN,
      feeVault: process.env.MATCH_FEE_VAULT_ADDRESS,
      owner: process.env.MATCH_CONTRACT_OWNER_ADDRESS, // have to be base64 encoded !
      operators,
      gameFeePercentage: BigInt(process.env.MATCH_GAME_FEE_PERCENTAGE),
    };
  }

  if (env === "dev" || env === "test") {
    if (!mockTokens) {
      assert.ok(
        !!configReturn?.token,
        "Must provide token address for Match when not mocking!"
      );
    }
  } else {
    assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
  }

  return configReturn;
};

export const validateEnv = (env : string) =>  {
  if (
    env !== "dev" &&
    env !== "test" &&
    env !== "prod"
  ) {
    throw new Error("Provide correct ENV_LEVEL (dev / test / prod)");
  }

  if (env === "prod") {
    assert.ok(
      process.env.TENDERLY_PROJECT_SLUG,
      "Must provide TENDERLY_PROJECT_SLUG in prod environment!"
    );
  }

  if (env !== "dev")
    assert.ok(
      !process.env.MONGO_DB_URI!.includes("localhost"),
      "Cannot use local mongo URI in 'prod' or 'test' environment!"
    );

  if (!process.env.MONGO_DB_URI || !process.env.MONGO_DB_NAME || !process.env.ARCHIVE_PREVIOUS_DB_VERSION) {
    throw new Error(`Must provide proper MONGO data used for ${env} environment!`);
  }

  if (process.env.VERIFY_CONTRACTS === "true") {
    assert.ok(!!process.env.ETHERSCAN_API_KEY, "Must provide an Etherscan API Key to verify contracts");
  }

  if (process.env.MONITOR_CONTRACTS === "true") {
    assert.ok(!!process.env.TENDERLY_PROJECT_SLUG, "Must provide a Tenderly Project Slug to monitor contracts");
    assert.ok(!!process.env.TENDERLY_ACCOUNT_ID, "Must provide a Tenderly Account ID to monitor contracts");
    assert.ok(!!process.env.TENDERLY_ACCESS_KEY, "Must provide a Tenderly Access Key to monitor contracts");
  }
};
