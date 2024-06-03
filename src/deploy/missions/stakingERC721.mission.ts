import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesContracts } from "../types.campaign";
import { contractNames } from "../contractNames";

export class ZModulesStakingERC721DM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IProviderBase,
IZModulesContracts
> {

  proxyData = {
    isProxy: false,
  };

  contractName = contractNames.stakingERC721.contract;
  instanceName = contractNames.stakingERC721.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      stakingERC721Config: {
        name,
        symbol,
        baseUri,
        stakingToken,
        rewardsToken,
        rewardsPerPeriod,
        periodLength,
        timeLockPeriod,
        contractOwner,
      },
    } = this.campaign.config;

    return [
      name,
      symbol,
      baseUri,
      stakingToken,
      rewardsToken,
      rewardsPerPeriod,
      periodLength,
      timeLockPeriod,
      contractOwner,
    ];
  }
}