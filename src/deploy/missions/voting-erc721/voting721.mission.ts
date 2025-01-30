import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  IVotingERC721Config,
  IZModulesConfig,
  IZModulesContracts,
} from "../../campaign/types";
import { contractNames } from "../../contract-names";


export const getVotingERC721Mission = (_instanceName ?: string) => {
  class ZModulesZeroVotingERC721DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = contractNames.votingERC721.contract;
    instanceName = !_instanceName ? contractNames.votingERC721.instance : _instanceName;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        config: {
          votingERC721Config,
        },
      } = this.campaign;

      const {
        name,
        symbol,
        version,
        baseUri,
        admin,
      } = votingERC721Config as IVotingERC721Config;

      return [
        name,
        symbol,
        version,
        baseUri,
        admin,
      ];
    }
  }

  return ZModulesZeroVotingERC721DM;
};
