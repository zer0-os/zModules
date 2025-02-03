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

export const createDefaultStakingConfig = async (
  contractOwner : SignerWithAddress,
  rewardsERC20 ?: MockERC20,
  erc721 ?: MockERC721,
  stakeERC20 ?: MockERC20,
  stakeRepERC20 ?: ZeroVotingERC20,
  stakeRepERC721 ?: ZeroVotingERC721,
) => {
  const config : Partial<BaseConfig> = {
    rewardsToken: rewardsERC20 ? await rewardsERC20.getAddress() : hre.ethers.ZeroAddress,
    minimumLockTime: DEFAULT_MINIMUM_LOCK,
    minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
    maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
    contractOwner: contractOwner.address,
    canExit: true,
  };

  if (erc721) {
    config.stakingToken = await erc721.getAddress();
    config.rewardsPerPeriod = DEFAULT_REWARDS_PER_PERIOD_ERC721;
    config.periodLength = DEFAULT_PERIOD_LENGTH_ERC721;
    config.stakeRepToken = await (stakeRepERC721 as ZeroVotingERC721).getAddress();

    return config as BaseConfig;
  } else {
    if (stakeERC20) {
      config.stakingToken = await stakeERC20.getAddress();
    } else {
      config.stakingToken = hre.ethers.ZeroAddress;
    }

    config.rewardsPerPeriod = DEFAULT_REWARDS_PER_PERIOD_ERC20;
    config.periodLength = DEFAULT_PERIOD_LENGTH_ERC20;
    config.stakeRepToken = await (stakeRepERC20 as ZeroVotingERC20).getAddress();

    return config as BaseConfig;
  }
};

export const getDefaultERC20SetupWithExit = async (
  owner : SignerWithAddress,
  rewardsToken : MockERC20,
  stakeToken : MockERC20,
  stakeRepToken : ZeroVotingERC20,
  canExit : boolean
) : Promise<StakingERC20> => {
  const config = await createDefaultStakingConfig(
    owner,
    rewardsToken,
    undefined,
    stakeToken,
    stakeRepToken
  );

  config.canExit = canExit;

  const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");

  const contract = await stakingFactory.deploy(config) as StakingERC20;

  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), await contract.getAddress());
  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), await contract.getAddress());

  return contract;
};

export const getDefaultERC20Setup = async (
  owner : SignerWithAddress,
  rewardsToken : MockERC20,
  stakeToken : MockERC20,
  stakeRepToken : ZeroVotingERC20,
) : Promise<[StakingERC20, BaseConfig]> => {
  const config = await createDefaultStakingConfig(
    owner,
    rewardsToken,
    undefined,
    stakeToken,
    stakeRepToken
  );

  const stakingFactory = await hre.ethers.getContractFactory("StakingERC20");

  const contract = await stakingFactory.deploy(config) as StakingERC20;

  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), await contract.getAddress());
  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), await contract.getAddress());

  return [contract, config];
};

export const getNativeSetupERC20 = async (
  owner : SignerWithAddress,
  stakeRepToken : ZeroVotingERC20,
) => {
  const config = await createDefaultStakingConfig(
    owner,
    undefined,
    undefined,
    undefined,
    stakeRepToken,
  );

  const localStakingFactory = await hre.ethers.getContractFactory("StakingERC20");
  const contract = await localStakingFactory.deploy(config) as StakingERC20;
  const contractAddress = await contract.getAddress();

  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), contractAddress);
  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), contractAddress);

  // Provide rewards funding in native token
  await fundRewards(contractAddress);

  return contract;
};

export const getNativeSetupERC721 = async (
  owner : SignerWithAddress,
  stakeToken : MockERC721,
  stakeRepToken : ZeroVotingERC721
) => {
  const config = await createDefaultStakingConfig(
    owner,
    undefined,
    stakeToken,
    undefined,
    undefined,
    stakeRepToken,
  );

  const stakingFactory = await hre.ethers.getContractFactory("StakingERC721");
  const contract = await stakingFactory.deploy(config) as StakingERC721;
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
    await stakeToken.connect(owner).transfer(
      address,
      amount ?? INIT_BALANCE
    );

    await stakeToken.connect(address).approve(
      contractAddress, amount ?? INIT_BALANCE
    );
  }
};

const fundRewards = async (contractAddress : string) => {
  await hre.network.provider.send("hardhat_setBalance", [
    contractAddress,
    `0x${hre.ethers.parseEther("999999999").toString()}`,
  ]
  );
};