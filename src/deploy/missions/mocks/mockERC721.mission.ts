import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";
import { TTokenType } from "./mockERC20.mission";


export const MOCK721_TOKEN_NAME_DEFAULT = "MOCK ERC 721";
export const MOCK721_TOKEN_SYMBOL_DEFAULT = "MOCK721";
export const MOCK721_TOKEN_BASE_URI_DEFAULT = "0://staked-wheels/";

export const getMockERC721Mission = ({
  tokenType,
  tokenName,
  tokenSymbol,
  baseUri,
} : {
  tokenType : TTokenType;
  tokenName : string;
  tokenSymbol : string;
  baseUri : string;
}) => {
  class ZModulesMockERC721DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = contractNames.mocks.erc721.contract;
    instanceName = `${contractNames.mocks.erc721.instance}${tokenType}`;

    get dbName () {
      return `${this.contractName}${tokenType}`;
    }

    async deployArgs () : Promise<TDeployArgs> {
      return [
        !!tokenName ? tokenName : MOCK721_TOKEN_NAME_DEFAULT,
        !!tokenSymbol ? tokenSymbol : MOCK721_TOKEN_SYMBOL_DEFAULT,
        !!baseUri ? baseUri : MOCK721_TOKEN_BASE_URI_DEFAULT,
      ];
    }
  }

  return ZModulesMockERC721DM;
};
