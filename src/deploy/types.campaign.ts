import {
  IContractState,
  IDeployCampaignConfig,
} from "@zero-tech/zdc";
import {
  StakingERC20,
  StakingERC721,
} from "../../typechain";
import {
  SignerWithAddress,
} from "@nomicfoundation/hardhat-ethers/signers";

export interface IStakingDeployArgs {
  rewardsToken : string;
  rewardsPerPeriod : bigint;
  periodLength : bigint;
  timeLockPeriod : bigint;
}

export interface IERC20DeployArgs extends IStakingDeployArgs {
  stakingToken : string;
}

export interface IERC721DeployArgs extends IStakingDeployArgs {
  stakingToken : string;
  name : string;
  symbol : string;
  baseUri : string;
}

export interface DCConfig extends IDeployCampaignConfig<SignerWithAddress> {
  owner : SignerWithAddress;
  stakingERC20Config : IERC20DeployArgs;
  stakingERC721Config : IERC721DeployArgs;
}

export type ZModulesContract =
  StakingERC20 |
  StakingERC721;

export interface IZModulesContracts extends IContractState<ZModulesContract> {
  stakingERC20 : StakingERC20;
  stakingERC721 : StakingERC721;
}

