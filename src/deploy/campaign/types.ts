import {
  IContractState,
  IDeployCampaignConfig,
} from "@zero-tech/zdc";
import {
  AccessControl,
  Match,
  StakingERC20,
  StakingERC721,
  TimelockController,
  ZDAO,
  ZeroVotingERC20,
  ZeroVotingERC721,
} from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export interface IStakingERC20Config {
  mockTokens : boolean;
  stakingToken ?: string;
  rewardsToken ?: string;
  stakeRepToken ?: string;
  rewardsPerPeriod : bigint;
  periodLength : bigint;
  minimumLockTime : bigint;
  contractOwner : string;
  minimumRewardsMultiplier : bigint;
  maximumRewardsMultiplier : bigint;
}

export interface IStakingERC721Config extends IStakingERC20Config {
  name : string;
  symbol : string;
  baseUri : string;
}

export interface IVotingERC20Config {
  name : string;
  symbol : string;
  admin : SignerWithAddress;
}

export interface IVotingERC721Config {
  name : string;
  symbol : string;
  version : string;
  baseUri : string;
  admin : SignerWithAddress;
}

export interface IDAOConfig {
  shouldRevokeAdminRole : boolean;
  governorName : string;
  votingToken ?: string;
  timeLockController ?: string;
  votingDelay : bigint;
  votingPeriod : bigint;
  proposalThreshold : bigint;
  quorumPercentage : bigint;
  voteExtension : bigint;
}

export interface IMatchConfig {
  token ?: string;
  feeVault : string;
  owner : string;
  operators : Array<string>;
  gameFeePercentage : bigint;
}

export interface ITimelockConfig {
  delay : bigint;
  proposers : Array<string>;
  executors : Array<string>;
  admin : SignerWithAddress;
  votingTokenInstName : string;
}

export interface IZModulesConfig extends IDeployCampaignConfig<SignerWithAddress> {
  votingERC20Config ?: IVotingERC20Config;
  votingERC721Config ?: IVotingERC721Config;
  stakingERC20Config ?: IStakingERC20Config;
  stakingERC721Config ?: IStakingERC721Config;
  matchConfig ?: IMatchConfig;
  daoConfig ?: IDAOConfig;
  timeLockConfig ?: ITimelockConfig;
}

export type ZModulesContract =
  StakingERC20 |
  StakingERC721 |
  ZeroVotingERC20 |
  ZeroVotingERC721 |
  ZDAO |
  AccessControl |
  Match |
  TimelockController;

export interface IZModulesContracts extends IContractState<ZModulesContract> {
  stakingERC20 : StakingERC20;
  stakingERC721 : StakingERC721;
}

export interface TestIMatchConfig extends IMatchConfig {
  token : string;
}
