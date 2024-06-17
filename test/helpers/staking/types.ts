import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseContract,
  ContractInterface,
} from "ethers";

export interface BaseConfig {
  stakeToken : string;
  rewardsToken : string;
  rewardsPerPeriod : bigint;
  periodLength : bigint; // length of a single rewards period
  timeLockPeriod : bigint; // The length of the time lock in seconds
  contractOwner : SignerWithAddress;
}

// Simplify the Ethers V6 contract type
export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

export type StakedOrClaimedAt = [bigint, bigint] & { stakeTimestamp : bigint; claimTimestamp : bigint; };