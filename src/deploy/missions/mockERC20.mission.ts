import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, IProviderBase, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesContracts } from "../types.campaign";


export const mockERC20Mission = (name : string, instance : string, localDBName : string) => {
  class ZModulesMockERC20DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
  > {

    contractName = name;
    instanceName = instance;

    get dbName () {
      return localDBName;
    }

    async deployArgs () : Promise<TDeployArgs> {

      return [
        this.contractName,
        "MOCK",
      ];
    }

    proxyData = {
      isProxy: false,
    };
  }
  return ZModulesMockERC20DM;
};

