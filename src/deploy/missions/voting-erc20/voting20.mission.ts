import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IVotingERC20Config, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";


export class ZModulesZeroVotingERC20DM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = contractNames.votingERC20.contract;
  instanceName = contractNames.votingERC20.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      config: {
        deployAdmin,
        votingERC20Config,
      },
    } = this.campaign;

    const {
      name,
      symbol,
      domainName,
      domainVersion,
    } = votingERC20Config as IVotingERC20Config;

    return [
      name,
      symbol,
      domainName,
      domainVersion,
      deployAdmin.address,
    ];
  }
}
