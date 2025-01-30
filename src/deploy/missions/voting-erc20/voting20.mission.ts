import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IVotingERC20Config, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";


export const getVotingERC20Mission = (_instanceName ?: string) => {
  class ZModulesZeroVotingERC20DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = contractNames.votingERC20.contract;
    instanceName = !_instanceName ? contractNames.votingERC20.instance : _instanceName;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        config: {
          votingERC20Config,
        },
      } = this.campaign;

      const {
        name,
        symbol,
        admin,
      } = votingERC20Config as IVotingERC20Config;

      return [
        name,
        symbol,
        admin.address,
      ];
    }
  }

  return ZModulesZeroVotingERC20DM;
};
