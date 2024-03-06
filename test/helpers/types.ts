import {
  BaseContract,
  ContractInterface,
} from "ethers";
import {
  Staking,
  MultiStaking,
} from "../../typechain";

export interface StakingConfig {
  stakingToken : string;
  rewardsToken : string;
  rewardsPerBlock : string;
}

// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

// For typing hardhat upgrades with Ethers v6
export type MultiStakingV6 = MultiStaking & ContractV6;
export type StakingV6 = Staking & ContractV6;