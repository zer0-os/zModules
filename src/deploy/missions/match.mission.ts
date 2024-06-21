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

      let args : TDeployArgs = [];

      const tokenInArgs = this.campaign.config.matchConfig.token;

      if (
        process.env.MOCK_TOKENS === "true" &&
        !tokenInArgs
      ) {
        args = args.concat(
          [await this.campaign.state.contracts.mockERC20.getAddress()],
          Object.values(this.campaign.config.matchConfig)
        );

      } else if (
        // TODO myself: double check is this right?
        process.env.MOCK_TOKENS === "false" ||
        tokenInArgs
      ) {
        args = Object.values(this.campaign.config.matchConfig);
      }

      return args;
    }
  }
  return ZModulesMatchDM;
};