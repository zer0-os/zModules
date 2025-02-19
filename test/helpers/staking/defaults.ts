import {
  MockERC721,
  MockERC20, ZeroVotingERC20, ZeroVotingERC721,
  StakingERC20,
  StakingERC721,
} from "../../../typechain";

import {
  BaseConfig,
} from "./types";

import * as hre from "hardhat";

import {
  DEFAULT_PERIOD_LENGTH_ERC721,
  DEFAULT_REWARDS_PER_PERIOD_ERC20,
  DEFAULT_REWARDS_PER_PERIOD_ERC721,
  DEFAULT_PERIOD_LENGTH_ERC20,
  DEFAULT_MINIMUM_LOCK,
  DEFAULT_MINIMUM_RM,
  DEFAULT_MAXIMUM_RM,
  INIT_BALANCE,
} from "../constants";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

export const createDefaultStakingConfig = async (
  erc721 ?: boolean
) : Promise<BaseConfig> => {
  const config : Partial<BaseConfig> = {
    minimumLockTime: DEFAULT_MINIMUM_LOCK,
    minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
    maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
    canExit: true,
    timestamp: BigInt(await time.latest()) + 1n, // Add 1n for hardhat auto mine
  };

  if (erc721) {
    config.rewardsPerPeriod = DEFAULT_REWARDS_PER_PERIOD_ERC721;
    config.periodLength = DEFAULT_PERIOD_LENGTH_ERC721;
    return config as BaseConfig;
  } else {
    // ERC20 or native token
    config.rewardsPerPeriod = DEFAULT_REWARDS_PER_PERIOD_ERC20;
    config.periodLength = DEFAULT_PERIOD_LENGTH_ERC20;
    return config as BaseConfig;
  }
};

export const getDefaultERC20Setup = async (
  owner : SignerWithAddress,
  rewardsToken : MockERC20,
  stakeToken : MockERC20,
  stakeRepToken : ZeroVotingERC20,
) : Promise<[StakingERC20, BaseConfig]> => {

  const config = await createDefaultStakingConfig(
    false
  );

  const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");

  // Add 1n for hardhat auto mine
  config.timestamp = BigInt(await time.latest()) + 1n;

  const contract = await stakingFactory.deploy(
    owner.address,
    await stakeToken.getAddress(),
    await rewardsToken.getAddress(),
    await stakeRepToken.getAddress(),
    config
  ) as StakingERC20;

  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), await contract.getAddress());
  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), await contract.getAddress());

  return [contract, config];
};

export const getNativeSetupERC20 = async (
  owner : SignerWithAddress,
  stakeRepToken : ZeroVotingERC20,
) : Promise<[StakingERC20, BaseConfig]> => {
  const config = await createDefaultStakingConfig(
    false
  );

  const localStakingFactory = await hre.ethers.getContractFactory("StakingERC20");

  const contract = await localStakingFactory.deploy(
    owner.address,
    hre.ethers.ZeroAddress,
    hre.ethers.ZeroAddress,
    await stakeRepToken.getAddress(),
    config
  ) as StakingERC20;

  const contractAddress = await contract.getAddress();

  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), contractAddress);
  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), contractAddress);

  // Provide rewards funding in native token
  await fundRewards(contractAddress);

  return [contract, config];
};

export const getNativeSetupERC721 = async (
  owner : SignerWithAddress,
  stakeToken : MockERC721,
  stakeRepToken : ZeroVotingERC721
) => {
  const config = await createDefaultStakingConfig(
    true
  );

  const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");

  const contract = await stakingFactory.deploy(
    owner.address,
    await stakeToken.getAddress(),
    hre.ethers.ZeroAddress,
    await stakeRepToken.getAddress(),
    config
  ) as StakingERC721;

  const contractAddress = await contract.getAddress();

  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), contractAddress);
  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), contractAddress);

  // Provide rewards funding in native token
  await fundRewards(contractAddress);

  return contract;
};

// Fund users and approve for an amount
export const fundAndApprove = async (
  owner : SignerWithAddress,
  addresses : Array<SignerWithAddress>,
  stakeToken : MockERC20,
  contractAddress : string,
  amount ?: bigint,
) => {
  for (const address of addresses) {
    await stakeToken.connect(owner).mint(
      address,
      amount ?? INIT_BALANCE
    );

    await stakeToken.connect(address).approve(
      contractAddress, amount ?? INIT_BALANCE
    );
  }
};

// For funding when using native token as rewards
const fundRewards = async (contractAddress : string) => {
  await hre.network.provider.send("hardhat_setBalance", [
    contractAddress,
    `0x${hre.ethers.parseEther("999999999").toString()}`,
  ]
  );
};