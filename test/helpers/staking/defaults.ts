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
  PRECISION_DIVISOR,
  DEFAULT_REWARDS_PER_PERIOD_ERC20,
  DEFAULT_REWARDS_PER_PERIOD_ERC721,
  LOCKED_PRECISION_DIVISOR,
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
    divisor: PRECISION_DIVISOR,
    lockedDivisor: LOCKED_PRECISION_DIVISOR,
    minimumRewardsMultiplier: DEFAULT_MINIMUM_RM,
    maximumRewardsMultiplier: DEFAULT_MAXIMUM_RM,
    contractOwner: contractOwner.address,
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

export const getDefaultERC20Setup = async (
  owner : SignerWithAddress,
  rewardsToken : MockERC20,
  stakeToken : MockERC20,
  stakeRepToken : ZeroVotingERC20,
): Promise<[StakingERC20, BaseConfig]> => {
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
}

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
  const localContract = await localStakingFactory.deploy(config) as StakingERC20;

  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), await localContract.getAddress());
  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), await localContract.getAddress());

  // Provide rewards funding in native token
  await owner.sendTransaction({
    to: await localContract.getAddress(),
    value: hre.ethers.parseEther("9999"),
  });

  return localContract;
}

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

  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.MINTER_ROLE(), await contract.getAddress());
  await stakeRepToken.connect(owner).grantRole(await stakeRepToken.BURNER_ROLE(), await contract.getAddress());

  // Provide rewards funding in native token
  await owner.sendTransaction({
    to: await contract.getAddress(),
    value: hre.ethers.parseEther("9999"),
  });

  return contract;
}

export const fundAndApprove = async (
  owner : SignerWithAddress,
  addresses : Array<SignerWithAddress>,
  stakeToken : MockERC20,
  contractAddress : string,
  amount ?: bigint,
) => {
  for (let i = 0; i < addresses.length; i++) {
    await stakeToken.connect(owner).transfer(
      addresses[i].address, amount ?? INIT_BALANCE
    );

    await stakeToken.connect(addresses[i]).approve(
      contractAddress, amount ?? INIT_BALANCE
    );
  }
}
