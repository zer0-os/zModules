import {
  BaseContract,
  ContractInterface,
} from "ethers";
import {
  MockERC20,
  MockERC721,
  Staking,
  MultiStaking,
} from "../../typechain";

export type StakingConfig = {
  stakingToken : string;
  rewardsToken : string;
  rewardsPerBlock : string;
}

export type ContractV6 = BaseContract & Omit<ContractInterface, keyof BaseContract>;

// For typing hardhat upgrades with Ethers v6
export type MultiStakingV6 = MultiStaking & ContractV6;
export type StakingV6 = Staking & ContractV6;