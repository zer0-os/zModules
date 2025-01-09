import {
  IContractState,
  IDeployCampaignConfig,
} from "@zero-tech/zdc";
import {
  IVotes,
  StakingERC20,
  StakingERC721,
  TimelockController,
} from "../../../typechain";
import {
  SignerWithAddress,
} from "@nomicfoundation/hardhat-ethers/signers";

export interface IStakingERC20DeployArgs {
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
  admin : string;
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

export interface IZModulesConfig extends IDeployCampaignConfig<SignerWithAddress> {
  mockTokens : boolean;
  stakingERC20Config ?: IStakingERC20DeployArgs;
  stakingERC721Config ?: IStakingERC721DeployArgs;
  matchConfig ?: IMatchDeployArgs;
}

export type ZModulesContract =
  StakingERC20 |
  StakingERC721;

export interface IZModulesContracts extends IContractState<ZModulesContract> {
  stakingERC20 : StakingERC20;
  stakingERC721 : StakingERC721;
}

export interface TestIERC721DeployArgs extends IStakingERC721DeployArgs {
  stakingToken : string;
  rewardsToken : string;
}

export interface TestIERC20DeployArgs extends IStakingERC20DeployArgs {
  stakingToken : string;
  rewardsToken : string;
}

export interface TestIMatchDeployArgs extends IMatchDeployArgs {
  token : string;
}
