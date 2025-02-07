import { BaseDeployMission } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ITimelockConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";


export const getTimelockControllerMission = () => {
  class ZModulesTimelockControllerDM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = contractNames.timelock.contract;
    instanceName = contractNames.timelock.instance;

    async deployArgs () {
      const {
        config: {
          timelockConfig,
        },
      } = this.campaign;

      const {
        delay,
        proposers,
        executors,
        admin,
      } = timelockConfig as ITimelockConfig;

      return [
        delay,
        proposers,
        executors,
        admin.address,
      ];
    }
  }
  return ZModulesTimelockControllerDM;
};
