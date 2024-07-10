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
  rewardsToken ?: string;
  rewardsPerPeriod : bigint;
  periodLength : bigint;
  timeLockPeriod : bigint;
  contractOwner : SignerWithAddress;
}

export interface IERC20DeployArgs extends IStakingDeployArgs {
  stakingToken ?: string;
}

export interface IERC721DeployArgs extends IStakingDeployArgs {
  stakingToken ?: string;
  name : string;
  symbol : string;
  baseUri : string;
}

export interface IMatchDeployArgs {
  token ?: string;
  feeVault : string;
  owner : string;
  operators : Array<string>;
  gameFeePercentage : bigint;
}

export interface IMockTokenData20 {
  tokenName : string;
  tokenSymbol : string;
}

export interface IMockTokenData721 extends IMockTokenData20 {
  baseTokenURI : string;
}

export interface IZModulesConfig extends IDeployCampaignConfig<SignerWithAddress> {
  owner : SignerWithAddress;
  mocks : {
    mockTokens : boolean;
    erc20 ?: IMockTokenData20;
    erc721 ?: IMockTokenData721;
  };
  stakingERC20Config ?: IERC20DeployArgs;
  stakingERC721Config ?: IERC721DeployArgs;
  matchConfig ?: IMatchDeployArgs;
}

export type ZModulesContract =
  StakingERC20 |
  StakingERC721;

export interface IZModulesContracts extends IContractState<ZModulesContract> {
  stakingERC20 : StakingERC20;
  stakingERC721 : StakingERC721;
}

export interface TestIERC721DeployArgs extends IERC721DeployArgs {
  stakingToken : string;
  rewardsToken : string;
}

export interface TestIERC20DeployArgs extends IERC20DeployArgs {
  stakingToken : string;
  rewardsToken : string;
}

export interface TestIMatchDeployArgs extends IMatchDeployArgs {
  token : string;
}
