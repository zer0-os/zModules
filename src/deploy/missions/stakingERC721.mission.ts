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
    ];
  }

  async needsPostDeploy () : Promise<boolean> {
    const { deployAdmin, owner } = this.campaign.config;
    if (deployAdmin.address !== (owner as SignerWithAddress).address) {
      return true;
    } else {
      return false;
    }
  }

  async postDeploy () : Promise<void> {
    const {
      stakingERC721,
      config: {
        deployAdmin,
        owner,
      },
    } = this.campaign;
    await stakingERC721.connect(deployAdmin).transferOwnership(owner.address);
  }
}