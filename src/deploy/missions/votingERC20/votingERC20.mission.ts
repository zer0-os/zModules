import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IVotingERC20DeployArgs, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contractNames";

export const getVotingERC20Mission = (_instanceName ?: string) => {
  class ZModulesVotingERC20DM extends BaseDeployMission<
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
      } = votingERC20Config as IVotingERC20DeployArgs;

      return [
        name,
        symbol,
        admin,
      ];
    }
  }

  return ZModulesVotingERC20DM;
};