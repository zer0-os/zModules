import {
  IContractState,
  IDeployCampaignConfig,
} from "@zero-tech/zdc";
import {
  StakingERC20,
  StakingERC721,
} from "../../typechain";
import {
  HardhatEthersSigner,
  SignerWithAddress,
} from "@nomicfoundation/hardhat-ethers/signers";

export interface IStakingDeployArgs {
  rewardsToken : string;
  rewardsPerPeriod : number;
  periodLength : number;
  timeLockPeriod : number;
}

export interface Ierc20DeployArgs extends IStakingDeployArgs {
  stakingToken : string;
}

export interface Ierc721DeployArgs extends IStakingDeployArgs {
  stakingToken : string;
  name : string;
  symbol : string;
  baseUri : string;
}

export interface DCConfig extends IDeployCampaignConfig<SignerWithAddress> {
  owner : SignerWithAddress;
  stakingERC20Config : Ierc20DeployArgs;
  stakingERC721Config : Ierc721DeployArgs;
}

export type ZModulesContract =
  StakingERC20 |
  StakingERC721;

export interface IZModulesContracts extends IContractState<ZModulesContract> {
  stakingERC20 : StakingERC20;
  stakingERC721 : StakingERC721;
}

