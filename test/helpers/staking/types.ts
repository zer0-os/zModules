import {
  BaseContract,
  ContractInterface,
} from "ethers";

export interface BaseConfig {
  timestamp : bigint;
  rewardsPerPeriod : bigint;
  periodLength : bigint;
  minimumLockTime : bigint;
  minimumRewardsMultiplier : bigint;
  maximumRewardsMultiplier : bigint;
  canExit : boolean;
}

// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

export type StakedOrClaimedAt = [bigint, bigint] & { stakeTimestamp : bigint; claimTimestamp : bigint; };
