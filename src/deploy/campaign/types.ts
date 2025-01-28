import { IContractState, IDeployCampaignConfig } from "@zero-tech/zdc";
import {
  IVotes,
  StakingERC20,
  StakingERC721,
  TimelockController,
} from "../../../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export interface IStakingERC20DeployArgs {
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

export interface IStakingERC721DeployArgs extends IStakingERC20DeployArgs {
  name : string;
  symbol : string;
  baseUri : string;
}

// TODO dep: rename all these ints that are configs from DeployArgs to DeployConfig,
//  since it's not all args and names are misleading
export interface IVotingERC20DeployArgs {
  name : string;
  symbol : string;
  admin : SignerWithAddress;
}

export interface IVotingERC721DeployArgs {
  name : string;
  symbol : string;
  version : string;
  baseUri : string;
  admin : SignerWithAddress;
}

export interface IDAODeployArgs {
  governorName : string;
  token : IVotes;
  timelock : TimelockController;
  votingDelay : bigint;
  votingPeriod : bigint;
  proposalThreshold : bigint;
  quorumPercentage : bigint;
  voteExtension : bigint;
}

export interface IMatchDeployArgs {
  token ?: string;
  feeVault : string;
  owner : string;
  operators : Array<string>;
  gameFeePercentage : bigint;
}

export interface ITimelockDeployArgs {
  delay : bigint;
  proposers : Array<string>;
  executors : Array<string>;
  admin : SignerWithAddress;
  votingTokenInstName : string;
}

export interface IZModulesConfig extends IDeployCampaignConfig<SignerWithAddress> {
  votingERC20Config ?: IVotingERC20DeployArgs;
  votingERC721Config ?: IVotingERC721DeployArgs;
  stakingERC20Config ?: IStakingERC20DeployArgs;
  stakingERC721Config ?: IStakingERC721DeployArgs;
  matchConfig ?: IMatchDeployArgs;
  // TODO dep: do we need this var here or in each individual config ??
  mockTokens : boolean;
}

// TODO dep: add all possible contracts here and check where it is used
export type ZModulesContract =
  StakingERC20 |
  StakingERC721;

export interface IZModulesContracts extends IContractState<ZModulesContract> {
  stakingERC20 : StakingERC20;
  stakingERC721 : StakingERC721;
}

export interface TestIMatchDeployArgs extends IMatchDeployArgs {
  token : string;
}
