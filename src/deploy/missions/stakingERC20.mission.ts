import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesContracts, Ierc20DeployArgs } from "../types.campaign";
import { contractNames } from "../contractNames";

export class ZModulesStakingERC20DM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IProviderBase,
IZModulesContracts
> {
  async deployArgs () : Promise<Ierc20DeployArgs> {
    const {
      config: {
        stakingERC20Config: {
          stakingToken,
          rewardsToken,
          rewardsPerPeriod,
          periodLength,
          timeLockPeriod,
        },
      },
    } = this.campaign;

    return [
      stakingToken,
      rewardsToken,
      rewardsPerPeriod,
      periodLength,
      timeLockPeriod,
    ];
  }

  contractName = contractNames.stakingERC20.contract;
  instanceName = contractNames.stakingERC20.instance;

  proxyData = {
    isProxy: false,
  };

  async needsPostDeploy () : Promise<boolean> {
    const { deployAdmin, owner } = this.campaign;
    if (deployAdmin.address !== owner.address) {
      return true;
    } else {
      return false;
    }
  }

  async postDeploy () : Promise<void> {
    const { stakingERC20, deployAdmin, owner } = this.campaign;
    await stakingERC20.connect(deployAdmin).transferOwnership(owner.address);
  }
}