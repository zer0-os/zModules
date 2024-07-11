import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IZModulesContracts } from "../types.campaign";
import { contractNames } from "../contractNames";


export const MOCK721_TOKEN_NAME_DEFAULT = "MOCK ERC 721";
export const MOCK721_TOKEN_SYMBOL_DEFAULT = "MOCK721";
export const MOCK721_TOKEN_BASE_URI_DEFAULT = "0://staked-wheels/";

export const getMockERC721Mission = ({
  tokenName,
  tokenSymbol,
  baseUri,
} : {
  tokenName : string;
  tokenSymbol : string;
  baseUri : string;
} = {
  tokenName: MOCK721_TOKEN_NAME_DEFAULT,
  tokenSymbol: MOCK721_TOKEN_SYMBOL_DEFAULT,
  baseUri: MOCK721_TOKEN_BASE_URI_DEFAULT,
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
    instanceName = contractNames.mocks.erc721.instance;

    async deployArgs () : Promise<TDeployArgs> {
      return [
        tokenName,
        tokenSymbol,
        baseUri,
      ];
    }
  }

  return ZModulesMockERC721DM;
};