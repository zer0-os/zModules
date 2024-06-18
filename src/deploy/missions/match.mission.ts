import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IProviderBase } from "@zero-tech/zdc/dist/deployer/types";
import { BaseDeployMission } from "@zero-tech/zdc/dist/missions/base-deploy-mission";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
import { IZModulesContracts } from "../types.campaign";
import { TDeployArgs } from "@zero-tech/zdc/dist/missions/types";

export const matchMission = (name : string, instance : string) => {
  class ZModulesMatchDM extends BaseDeployMission<
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

      let args : TDeployArgs;

      if (process.env.ENV_LEVEL === "dev") {
        this.campaign.config.matchConfig.token = this.campaign.state.contracts.mockERC20;

        args =  Object.values(this.campaign.config.matchConfig);

      } else if (
        process.env.ENV_LEVEL === "test" ||
      process.env.ENV_LEVEL === "prod"
      ) {
        args = Object.values(this.campaign.config.matchconfig);
      }

      return args;
    }
  }
  return ZModulesMatchDM;
};