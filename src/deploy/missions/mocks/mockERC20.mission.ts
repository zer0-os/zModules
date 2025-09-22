import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";


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

export const getMockERC20Mission = ({
  tokenType,
  tokenName,
  tokenSymbol,
} : {
  tokenType : TTokenType;
  tokenName ?: string;
  tokenSymbol ?: string;
}) => {
  class ZModulesMockERC20DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = contractNames.mockErc20.contract;
    instanceName = `${contractNames.mockErc20.instance}${tokenType}`;

    get dbName () {
      return `${this.contractName}${tokenType}`;
    }

    async deployArgs () : Promise<TDeployArgs> {
      return [
        !!tokenName ? tokenName : MOCK20_TOKEN_NAME_DEFAULT,
        !!tokenSymbol ? tokenSymbol : MOCK20_TOKEN_SYMBOL_DEFAULT,
      ];
    }
  }

  return ZModulesMockERC20DM;
};

