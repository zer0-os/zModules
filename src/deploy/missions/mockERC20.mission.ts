import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IZModulesContracts } from "../types.campaign";


export const MOCK20_TOKEN_NAME_DEFAULT = "MOCK ERC 20";
export const MOCK20_TOKEN_SYMBOL_DEFAULT = "MOCK20";

export const mockERC20Mission = (name : string, instance : string, localDBName : string) => {
  class ZModulesMockERC20DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
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

    async deployArgs () : Promise<TDeployArgs> {
      const {
        config: {
          mocks: {
            erc20,
          },
        },
      } = this.campaign;

      return [
        !!erc20 ? erc20.tokenName : MOCK20_TOKEN_NAME_DEFAULT,
        !!erc20 ? erc20.tokenSymbol : MOCK20_TOKEN_SYMBOL_DEFAULT,
      ];
    }
  }

  return ZModulesMockERC20DM;
};

