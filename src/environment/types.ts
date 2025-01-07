export interface IZModulesEnvironment extends
  IBaseEnvironment,
  IStaking20Environment,
  IStaking721Environment {}

export interface IBaseEnvironment {
  ENV_LEVEL : string;
  CONFIRMATION_N ?: string;
  MAINNET_RPC_URL ?: string;
  SEPOLIA_RPC_URL ?: string;
  ZCHAIN_MOONWALKER_RPC_URL ?: string;
  ZCHAIN_MAIN_RPC_URL ?: string;
  DEPLOY_ADMIN_MAINNET_PK ?: string;
  DEPLOY_ADMIN_SEPOLIA_PK ?: string;
  DEPLOY_ADMIN_ZCHAIN_MOONWALKER_PK ?: string;
  DEPLOY_ADMIN_ZCHAIN_MAIN_PK ?: string;
  MONGO_DB_URI : string;
  MONGO_DB_NAME : string;
  MONGO_DB_CLIENT_OPTS ?: string;
  MONGO_DB_VERSION ?: string;
  ARCHIVE_PREVIOUS_DB_VERSION : string;
  LOG_LEVEL : string;
  SILENT_LOGGER : string;
  MAKE_LOG_FILE ?: string;
  VERIFY_CONTRACTS : string;
  ETHERSCAN_API_KEY ?: string;
  MOCK_TOKENS : string;
}

export interface IStaking20Environment {
  STAKING20_STAKING_TOKEN : string;
  STAKING20_REWARDS_TOKEN : string;
  STAKING20_REP_TOKEN : string;
  STAKING20_CONTRACT_OWNER : string;
  STAKING20_REWARDS_PER_PERIOD : string;
  STAKING20_PERIOD_LENGTH : string;
  STAKING20_MIN_LOCK_TIME : string;
  STAKING20_MIN_REWARDS_MULTIPLIER : string;
  STAKING20_MAX_REWARDS_MULTIPLIER : string;
}

export interface IStaking721Environment {
  STAKING721_TOKEN_NAME : string;
  STAKING721_TOKEN_SYMBOL : string;
  STAKING721_BASE_URI : string;
  STAKING721_STAKING_TOKEN : string;
  STAKING721_REWARDS_TOKEN : string;
  STAKING721_REP_TOKEN : string;
  STAKING721_CONTRACT_OWNER : string;
  STAKING721_REWARDS_PER_PERIOD : string;
  STAKING721_PERIOD_LENGTH : string;
  STAKING721_MIN_LOCK_TIME : string;
  STAKING721_MIN_REWARDS_MULTIPLIER : string;
  STAKING721_MAX_REWARDS_MULTIPLIER : string;
}
