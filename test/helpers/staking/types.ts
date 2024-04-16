import {
  BaseContract,
  ContractInterface,
} from "ethers";


// export enum TokenType {
//   IERC721,
//   IERC20,
//   IERC1155
// }

export interface PoolConfig {
  stakingToken : string;
  rewardsToken : string;
  // stakingTokenType : TokenType;
  // rewardsPerPeriod : bigint; // rewards given each period
  poolWeight : bigint; // percent used in calc rewards
  periodLength : bigint; // length of a single rewards period
  timeLockPeriod : bigint; // The length of the time lock in seconds
}

// export interface RewardsConfig {
//   timePassed : bigint;
//   rewardWeight : bigint;
//   rewardPeriod : bigint;
//   stakeAmount : bigint;
// }
// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

export type StakedOrClaimedAt = [bigint, bigint] & { stakeTimestamp : bigint; claimTimestamp : bigint; };