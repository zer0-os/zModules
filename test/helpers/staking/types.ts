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
  // stakingTokenType : TokenType; // TODO not needed? maybe for 1155
  rewardsPerPeriod : bigint; // rewards given each period of a single period
  rewardsPeriod : bigint; // length of a single rewards period in days (TODO seconds?)
  rewardsFraction : bigint; // percent of staked amount that is used in calc rewards
  timeLockPeriods : bigint; // The length of the time lock in # of periods 
}

// export interface Stake {
//   poolId : string;
//   tokenId : string;
//   amount : string;
//   index : string;
//   stakedOrClaimedAt : string;
// }

export interface RewardsConfig {
  timePassed : bigint;
  rewardWeight : bigint;
  rewardPeriod : bigint;
  stakeAmount : bigint;
}
// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

// For typing hardhat upgrades with Ethers v6
// export type MultiStakingV6 = MultiStaking & ContractV6;
// export type Staking721V6 = Staking721 & ContractV6;