import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesContracts } from "../types.campaign";

export const stakingERC20Mission = (name : string, instance : string, localDBName ?: string) => {
  class ZModulesStakingERC20DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
  > {

    proxyData = {
      isProxy: false,
    };

    contractName = name;
    instanceName = instance;


    async deployArgs () : Promise<TDeployArgs> {

      const envLevel = this.campaign.config.env;
      const contractConfig = this.campaign.config.stakingERC20Config;

      if (
        envLevel === "dev" &&
      (
        !contractConfig.stakingToken &&
        !contractConfig.rewardsToken
      )
      ) {
        const {
          config: {
            stakingERC20Config: {
              rewardsPerPeriod,
              periodLength,
              timeLockPeriod,
              contractOwner,
            },
          },
        } = this.campaign;

        return [
          await this.campaign.state.contracts.mockERC20.getAddress(),
          await this.campaign.state.contracts.mockERC20Second.getAddress(),
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
        return Object.values(this.campaign.config.stakingERC20Config);
      }
    }
  }
  return ZModulesStakingERC20DM;
};