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

    proxyData = {
      isProxy: false,
    };

    contractName = name;
    instanceName = instance;

    get dbName () {
      return localDBName;
    }

    async getFromDB () {
      const allContracts = await this.campaign.dbAdapter.getContracts(this.contractName);
      const deployArgs = await this.deployArgs();

      if (allContracts) {
        const curContract = allContracts.find(
          el => el.args === JSON.stringify(deployArgs)
        );
        if (curContract) return curContract;
      }

      return null;
    }

    async deployArgs () : Promise<TDeployArgs> {
      if (this.instanceName === "mockERC20Second") {
        return [
          `${this.contractName}Second`,
          "SecondMOCK",
        ];
      } else return [
        this.contractName,
        "MOCK",
      ];
    }
  }
  return ZModulesMockERC20DM;
};

