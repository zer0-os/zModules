import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IProviderBase } from "@zero-tech/zdc/dist/deployer/types";
import { BaseDeployMission } from "@zero-tech/zdc/dist/missions/base-deploy-mission";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
import { DCConfig, IMatchDeployArgs, IZModulesContracts } from "../types.campaign";
import { TDeployArgs } from "@zero-tech/zdc/dist/missions/types";


export const matchMission = (_contractName : string, _instanceName : string) => {
  class ZModulesMatchDM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
  > {

    proxyData = {
      isProxy: false,
    };

    contractName = _contractName;
    instanceName = _instanceName;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        matchConfig,
        mockTokens,
      } = this.campaign.config as DCConfig;

      const {
        token,
        feeVault,
        owner,
        operators,
      } = matchConfig as IMatchDeployArgs;

      if (mockTokens === true && !token) {
        return [
          await this.campaign.state.contracts.mockERC20.getAddress(),
          feeVault,
          owner,
          operators,
        ];

      } else {
        if (!token) {
          throw new Error("Must provide token for Match if not mocking");
        }
        return [
          token,
          feeVault,
          owner,
          operators,
        ];
      }
    }
  }
  return ZModulesMatchDM;
};