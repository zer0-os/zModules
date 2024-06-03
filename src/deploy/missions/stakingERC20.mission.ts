import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesContracts } from "../types.campaign";
import { contractNames } from "../contractNames";

export class ZModulesStakingERC20DM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IProviderBase,
IZModulesContracts
> {
  async deployArgs () : Promise<TDeployArgs> {
    const {
      config: {
        stakingERC20Config: {
          stakingToken,
          rewardsToken,
          rewardsPerPeriod,
          periodLength,
          timeLockPeriod,
          contractOwner,
        },
      },
    } = this.campaign;

    return [
      stakingToken,
      rewardsToken,
      rewardsPerPeriod,
      periodLength,
      timeLockPeriod,
      contractOwner,
    ];
  }

  contractName = contractNames.stakingERC20.contract;
  instanceName = contractNames.stakingERC20.instance;

  proxyData = {
    isProxy: false,
  };
}