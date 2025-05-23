import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission } from "@zero-tech/zdc/dist/missions/base-deploy-mission";
import { HardhatRuntimeEnvironment } from "hardhat/types/runtime";
import { TDeployArgs } from "@zero-tech/zdc/dist/missions/types";
import { contractNames } from "../../contract-names";
import { IMatchConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";


export class ZModulesMatchDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = contractNames.match.contract;
  instanceName = contractNames.match.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      config: {
        matchConfig,
      },
      mockErc20,
    } = this.campaign;

    const {
      token,
      feeVault,
      owner,
      operators,
      gameFeePercentage,
    } = matchConfig as IMatchConfig;

    if (!token && mockErc20) {
      return [
        await mockErc20.getAddress(),
        feeVault,
        owner,
        operators,
        gameFeePercentage,
      ];
    } else {
      if (!token) {
        throw new Error("Must provide token to use for Match contract if not mocking");
      }
      return [
        token,
        feeVault,
        owner,
        operators,
        gameFeePercentage,
      ];
    }
  }
}
