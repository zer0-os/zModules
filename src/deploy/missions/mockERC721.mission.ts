import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, IProviderBase, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesContracts } from "../types.campaign";
import { contractNames } from "../contractNames";


export const mockERC721Mission = (name : string, instance : string, localDBName : string) => {
  class ZModulesMockERC721DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
  > {

    contractName = contractNames.mocks.erc721.contract;
    instanceName = contractNames.mocks.erc721.instance;

    get dbName () {
      return localDBName;
    }

    async deployArgs () : Promise<TDeployArgs> {

      return [
        this.contractName,
        "MOCK",
        "0://staked-wheels/",
      ];
    }

    proxyData = {
      isProxy: false,
    };
  }
  return ZModulesMockERC721DM;
};