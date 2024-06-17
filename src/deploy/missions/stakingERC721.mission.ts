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

    const envLevel = this.campaign.config.env;
    const contractConfig = this.campaign.config.stakingERC721Config;

    if (
      envLevel === "dev" &&
      (
        !contractConfig.stakingToken &&
        !contractConfig.rewardsToken
      )
    ) {
      const {
        config: {
          stakingERC721Config: {
            name,
            symbol,
            baseUri,
            rewardsPerPeriod,
            periodLength,
            timeLockPeriod,
            contractOwner,
          },
        },
      } = this.campaign;

      return [
        name,
        symbol,
        baseUri,
        await this.campaign.state.contracts.mockERC721.getAddress(),
        await this.campaign.state.contracts.mockERC20.getAddress(),
        rewardsPerPeriod,
        periodLength,
        timeLockPeriod,
        contractOwner,
      ];
    } else if (
      envLevel === "test" ||
      envLevel === "prod" ||
      (
        envLevel === "dev" &&
        contractConfig.stakingToken &&
        contractConfig.rewardsToken
      )
    ) {
      return Object.values(this.campaign.config.stakingERC721Config);
    }
  }
}