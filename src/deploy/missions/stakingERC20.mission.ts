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
      _stakingToken,
      _rewardsToken,
      _rewardsPerPeriod,
      _periodLength,
      _timeLockPeriod,
    } = this.campaign.config;

    return [
      _stakingToken,
      _rewardsToken,
      _rewardsPerPeriod,
      _periodLength,
      _timeLockPeriod,
    ];
  }

  contractName = contractNames.stakingERC20.contract;
  instanceName = contractNames.stakingERC20.instance;

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