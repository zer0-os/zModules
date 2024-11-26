import {
  BaseContract,
  ContractInterface,
} from "ethers";

export interface BaseConfig {
  stakingToken : string;
  rewardsToken : string;
  rewardsPerPeriod : bigint;
  periodLength : bigint;
}

// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

export type StakedOrClaimedAt = [bigint, bigint] & { stakeTimestamp : bigint; claimTimestamp : bigint; };