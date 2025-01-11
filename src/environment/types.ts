import { TEnvironment, TSupportedChain } from "@zero-tech/zdc";


export interface IZModulesEnvironment extends
  IBaseEnvironment,
  IStaking20Environment,
  IStaking721Environment,
  IVoting20Environment,
  IVoting721Environment,
  IDAOEnvironment,
  ITimeLockEnvironment {}

export interface IBaseEnvironment {
  ENV_LEVEL : TEnvironment;
  CONFIRMATIONS_N : string;
  SRC_CHAIN_NAME : TSupportedChain;
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
  ETHERSCAN_API_KEY ?: string;
  MONITOR_CONTRACTS : string;
  VERIFY_CONTRACTS : string;
  TENDERLY_PROJECT_SLUG ?: string;
}

export interface IStaking20Environment {
  MOCK_TOKENS : string;
  STAKING20_STAKING_TOKEN ?: string;
  STAKING20_REWARDS_TOKEN ?: string;
  STAKING20_REP_TOKEN ?: string;
  // TODO dep: decide what to do with it cause we need to pass it as Private Key to HH config to get a signer
  //  into campaign config. Same for Staking721
  STAKING20_CONTRACT_OWNER ?: string;
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
  STAKING721_STAKING_TOKEN ?: string;
  STAKING721_REWARDS_TOKEN ?: string;
  STAKING721_REP_TOKEN : string;
  STAKING721_CONTRACT_OWNER : string;
  STAKING721_REWARDS_PER_PERIOD : string;
  STAKING721_PERIOD_LENGTH : string;
  STAKING721_MIN_LOCK_TIME : string;
  STAKING721_MIN_REWARDS_MULTIPLIER : string;
  STAKING721_MAX_REWARDS_MULTIPLIER : string;
}

export interface IVoting20Environment {
  VOTING20_NAME : string;
  VOTING20_SYMBOL : string;
}

export interface IVoting721Environment {
  VOTING721_NAME : string;
  VOTING721_SYMBOL : string;
}

export interface IDAOEnvironment {
  DAO_GOV_NAME : string;
  DAO_VOTING_TOKEN ?: string;
  DAO_TIMELOCK_CONTROLLER ?: string;
  DAO_VOTING_DELAY : string;
  DAO_VOTING_PERIOD : string;
  DAO_PROPOSAL_THRESHOLD : string;
  DAO_QUORUM_PERCENTAGE : string;
  DAO_VOTE_EXTENSION : string;
}

export interface ITimeLockEnvironment {
  TIMELOCK_DELAY : string;
  TIMELOCK_PROPOSERS ?: string;
  TIMELOCK_EXECUTORS ?: string;
  TIMELOCK_ADMIN ?: string;
  TIMELOCK_VOTING_TOKEN_TYPE : string;
}
