import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesContracts } from "../types.campaign";

export class ZModulesStakingERC721DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
> {

  async deployArgs(): Promise<TDeployArgs> {
    const {
      name,
      symbol,
      baseUri,
      _stakingToken,
      _rewardsToken,
      _rewardsPerPeriod,
      _periodLength,
      _timeLockPeriod,
    } = this.campaign.config;

    return [
      name,
      symbol,
      baseUri,
      _stakingToken,
      _rewardsToken,
      _rewardsPerPeriod,
      _periodLength,
      _timeLockPeriod,
    ];
  }

  async needsPostDeploy(): Promise<boolean> {
    const { deployAdmin, owner } = this.campaign;
    if (deployAdmin.address !== owner.address) {
      return true;
    } else {
      return false;
    }
  }

  async postDeploy(): Promise<void> {
    const { stakingERC721, deployAdmin, owner } = this.campaign;
    await stakingERC721.connect(deployAdmin).transferOwnership(owner.address);
  }
}