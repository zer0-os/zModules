import {
  BaseContract,
  ContractInterface,
} from "ethers";
import {
  Staking,
  MultiStaking,
} from "../../../typechain";

export enum TokenType {
  IERC721,
  IERC20,
  IERC1155
}
export interface PoolConfig {
  stakingToken: string;
  rewardsToken: string;
  stakingTokenType: TokenType;
  rewardWeightMult: bigint;
  rewardWeightDiv: bigint;
  rewardPeriod: bigint;
  minRewardsTime: string; // BigInt or number instead?
}

export interface Stake {
  poolId: string;
  tokenId: string;
  amount: string;
  index: string;
  stakedOrClaimedAt: string;
}

export interface RewardsConfig {
  timePassed: bigint;
  rewardWeightMult: bigint;
  rewardWeightDiv: bigint;
  rewardPeriod: bigint;
  stakeAmount: bigint;
}
// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

// For typing hardhat upgrades with Ethers v6
export type MultiStakingV6 = MultiStaking & ContractV6;
export type StakingV6 = Staking & ContractV6;