import {
  IContractState,
  IDeployCampaignConfig,
} from "@zero-tech/zdc";
import {
  Match,
  MockERC20,
  MockERC721,
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
  shouldRevokeAdminRole : boolean;
  stakingToken ?: string;
  rewardsToken ?: string;
  stakeRepToken ?: string;
  rewardsPerPeriod : bigint;
  periodLength : bigint;
  minimumLockTime : bigint;
  contractOwner : string;
  minimumRewardsMultiplier : bigint;
  maximumRewardsMultiplier : bigint;
  canExit : boolean;
}

export interface IStakingERC721Config extends IStakingERC20Config {}

export interface IVotingERC20Config {
  name : string;
  symbol : string;
  domainName : string;
  domainVersion : string;
  admin : SignerWithAddress;
}

export interface IVotingERC721Config {
  name : string;
  symbol : string;
  baseUri : string;
  domainName : string;
  domainVersion : string;
  admin : SignerWithAddress;
}

export interface IDAOConfig {
  shouldRevokeAdminRole : boolean;
  governorName : string;
  votingToken ?: string;
  timelockController ?: string;
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
  MockERC20 |
  MockERC721 |
  ZDAO |
  Match |
  TimelockController;

export interface IZModulesContracts extends IContractState<ZModulesContract> {
  staking20 : StakingERC20;
  staking721 : StakingERC721;
  votingErc20 : ZeroVotingERC20;
  votingErc721 : ZeroVotingERC721;
  mockErc20STK : MockERC20;
  mockErc20REW : MockERC20;
  mockErc721STK : MockERC721;
  zDao : ZDAO;
  match : Match;
  timelockController : TimelockController;
}
