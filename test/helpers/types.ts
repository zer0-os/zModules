import {
  BaseContract,
  ContractInterface,
} from "ethers";
import {
  Staking,
  MultiStaking,
} from "../../typechain";

export enum TokenType {
  IERC721,
  IERC20,
  IERC1155
}
export interface StakeConfig {
  stakingToken : string;
  rewardsToken : string;
  rewardsVault : string;
  stakingTokenType : TokenType;
  rewardsTokenType : TokenType;
  rewardsPerBlock : string;
  minRewardsTime : string; // BigInt or number instead?
}

// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

// For typing hardhat upgrades with Ethers v6
export type MultiStakingV6 = MultiStaking & ContractV6;
export type StakingV6 = Staking & ContractV6;