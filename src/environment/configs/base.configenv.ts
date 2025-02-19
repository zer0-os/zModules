import { IBaseEnvironment } from "../types";


/**
 * Base default environment configuration applicable to all contracts
 */
export const baseConfig : IBaseEnvironment = {
  ENV_LEVEL: "dev",
  CONFIRMATIONS_N: "0",
  SRC_CHAIN_NAME: "zchain",
  // RPCs for actual networks
  MAINNET_RPC_URL: "",
  SEPOLIA_RPC_URL: "",
  ZCHAIN_MOONWALKER_RPC_URL: "",
  ZCHAIN_MAIN_RPC_URL: "",
  // Required Private Keys for actual chains
  DEPLOY_ADMIN_MAINNET_PK: "",
  DEPLOY_ADMIN_SEPOLIA_PK: "",
  DEPLOY_ADMIN_ZCHAIN_MOONWALKER_PK: "",
  DEPLOY_ADMIN_ZCHAIN_MAIN_PK: "",
  // MongoDB setup
  MONGO_DB_URI: `mongodb://localhost:2701${process.argv.includes("coverage") ? "7" : "8"}`,
  MONGO_DB_NAME: "zmodules-test",
  MONGO_DB_CLIENT_OPTS: "",
  MONGO_DB_VERSION: "",
  ARCHIVE_PREVIOUS_DB_VERSION: "false",
  // Logger vars
  LOG_LEVEL: "debug",
  SILENT_LOGGER: "true",
  MAKE_LOG_FILE: "false",
  //  Etherscan
  VERIFY_CONTRACTS: "false",
  ETHERSCAN_API_KEY: "",
  MONITOR_CONTRACTS: "false",
  TENDERLY_PROJECT_SLUG: "",
};
