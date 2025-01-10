import { IStaking20Environment, IStaking721Environment } from "../types";
import {
  DEFAULT_MAXIMUM_RM,
  DEFAULT_MINIMUM_LOCK,
  DEFAULT_MINIMUM_RM,
  DEFAULT_PERIOD_LENGTH_ERC20,
  DEFAULT_PERIOD_LENGTH_ERC721,
  DEFAULT_REWARDS_PER_PERIOD_ERC20,
  DEFAULT_REWARDS_PER_PERIOD_ERC721,
  STAKING721_TOKEN_NAME_DEFAULT,
} from "../../../test/helpers/constants";


/**
 * Default environment for StakingERC20
 */
export const staking20Config : IStaking20Environment = {
  MOCK_TOKENS: "true",
  STAKING20_STAKING_TOKEN: "",
  STAKING20_REWARDS_TOKEN: "",
  STAKING20_REP_TOKEN: "",
  STAKING20_CONTRACT_OWNER: "",
  STAKING20_REWARDS_PER_PERIOD: DEFAULT_REWARDS_PER_PERIOD_ERC20.toString(),
  STAKING20_PERIOD_LENGTH: DEFAULT_PERIOD_LENGTH_ERC20.toString(),
  STAKING20_MIN_LOCK_TIME: DEFAULT_MINIMUM_LOCK.toString(),
  STAKING20_MIN_REWARDS_MULTIPLIER: DEFAULT_MINIMUM_RM.toString(),
  STAKING20_MAX_REWARDS_MULTIPLIER: DEFAULT_MAXIMUM_RM.toString(),
};

/**
 * Default environment for StakingERC721
 */
export const staking721Config : IStaking721Environment = {
  // Staking for ERC721
  STAKING721_TOKEN_NAME: STAKING721_TOKEN_NAME_DEFAULT,
  STAKING721_TOKEN_SYMBOL: "STK721",
  STAKING721_BASE_URI: "https://staking721.com/",
  STAKING721_STAKING_TOKEN: "",
  STAKING721_REWARDS_TOKEN: "",
  STAKING721_REP_TOKEN: "",
  STAKING721_CONTRACT_OWNER: "",
  STAKING721_REWARDS_PER_PERIOD: DEFAULT_REWARDS_PER_PERIOD_ERC721.toString(),
  STAKING721_PERIOD_LENGTH: DEFAULT_PERIOD_LENGTH_ERC721.toString(),
  STAKING721_MIN_LOCK_TIME: DEFAULT_MINIMUM_LOCK.toString(),
  STAKING721_MIN_REWARDS_MULTIPLIER: DEFAULT_MINIMUM_RM.toString(),
  STAKING721_MAX_REWARDS_MULTIPLIER: DEFAULT_MAXIMUM_RM.toString(),
};
