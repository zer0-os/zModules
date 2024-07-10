import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IZModulesContracts } from "../types.campaign";
import { contractNames } from "../contractNames";


export const MOCK721_TOKEN_NAME_DEFAULT = "MOCK ERC 721";
export const MOCK721_TOKEN_SYMBOL_DEFAULT = "MOCK721";
export const MOCK721_TOKEN_BASE_URI_DEFAULT = "0://staked-wheels/";

export const getMockERC721Mission = () => {
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
      const {
        config: {
          mocks: {
            erc721,
          },
        },
      } = this.campaign;

      return [
        !!erc721 ? erc721.tokenName : MOCK721_TOKEN_NAME_DEFAULT,
        !!erc721 ? erc721.tokenSymbol : MOCK721_TOKEN_SYMBOL_DEFAULT,
        !!erc721 ? erc721.baseTokenURI : MOCK721_TOKEN_BASE_URI_DEFAULT,
      ];
    }
  }

  return ZModulesMockERC721DM;
};