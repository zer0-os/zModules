import {
  BaseContract,
  ContractInterface,
} from "ethers";
import {
  Staking721,
  // MultiStaking,
} from "../../../typechain";

export enum TokenType {
  IERC721,
  IERC20,
  IERC1155
}
export interface PoolConfig {
  stakingToken : string;
  rewardsToken : string;
  // stakingTokenType : TokenType;
  // rewardsPerPeriod : bigint; // rewards given each period
  poolWeight : bigint; // percent used in calc rewards
  periodLength : bigint; // length of a single rewards period
  timeLockPeriod : bigint; // The length of the time lock in seconds
}

export interface RewardsConfig {
  timePassed : bigint;
  rewardWeight : bigint;
  rewardPeriod : bigint;
  stakeAmount : bigint;
}
// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

export type Maybe<T> = T | null | undefined;
// For typing hardhat upgrades with Ethers v6
// export type MultiStakingV6 = MultiStaking & ContractV6;
// export type Staking721V6 = Staking721 & ContractV6;