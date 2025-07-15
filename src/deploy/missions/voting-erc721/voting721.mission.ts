import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  IVotingERC721Config,
  IZModulesConfig,
  IZModulesContracts,
} from "../../campaign/types";
import { contractNames } from "../../contract-names";


export class ZModulesZeroVotingERC721DM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = contractNames.votingERC721.contract;
  instanceName = contractNames.votingERC721.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      config: {
        deployAdmin,
        votingERC721Config,
      },
    } = this.campaign;

    const {
      name,
      symbol,
      baseUri,
      domainName,
      domainVersion,
    } = votingERC721Config as IVotingERC721Config;

    return [
      name,
      symbol,
      baseUri,
      domainName,
      domainVersion,
      deployAdmin.address,
    ];
  }
}
