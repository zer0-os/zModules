import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IZModulesContracts } from "../types.campaign";
import { contractNames } from "../contractNames";


export type TTokenType = "STK" | "REW" | "";
export interface ITokenTypes {
  staking : TTokenType;
  rewards : TTokenType;
  general : TTokenType;
}

export const TokenTypes : ITokenTypes = {
  staking: "STK",
  rewards: "REW",
  general: "",
};

export const MOCK20_TOKEN_NAME_DEFAULT = "MOCK ERC 20";
export const MOCK20_TOKEN_SYMBOL_DEFAULT = "MOCK20";

export const getMockERC20Mission = (tokenType : TTokenType) => {
  class ZModulesMockERC20DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = contractNames.mocks.erc20.contract;
    instanceName = `${contractNames.mocks.erc20.instance}${tokenType}`;

    get dbName () {
      return `${this.contractName}${tokenType}`;
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

