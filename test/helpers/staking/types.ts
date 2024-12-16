import {
  BaseContract,
  ContractInterface,
} from "ethers";

export interface BaseConfig {
  stakingToken : string;
  rewardsToken : string;
  stakeRepToken : string;
  rewardsPerPeriod : bigint;
  periodLength : bigint;
  minimumLockTime : bigint;
  divisor : bigint;
  lockedDivisor : bigint;
  minimumRewardsMultiplier : bigint;
  maximumRewardsMultiplier : bigint;
  contractOwner : string;
}

// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

export type StakedOrClaimedAt = [bigint, bigint] & { stakeTimestamp : bigint; claimTimestamp : bigint; };
