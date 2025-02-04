import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IDAOConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";


export const getDAOMission = (_instanceName ?: string) => {
  class ZModulesZDAODM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = contractNames.dao.contract;
    instanceName = !_instanceName ? contractNames.dao.instance : _instanceName;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        config: {
          daoConfig,
        },
        mockVotingToken,
        mockTimelock,
      } = this.campaign;

      const {
        governorName,
        token,
        timelock,
        votingDelay,
        votingPeriod,
        proposalThreshold,
        quorumPercentage,
        voteExtension,
      } = daoConfig as IDAOConfig;

      if (
        (token || mockVotingToken) &&
        (timelock || mockTimelock)
      ) {
        return [
          governorName,
          token ? token : await mockVotingToken.getAddress(),
          timelock ? timelock : await mockTimelock.getAddress(),
          votingDelay,
          votingPeriod,
          proposalThreshold,
          quorumPercentage,
          voteExtension,
        ];
      } else {
        throw new Error("Must provide voting token and timelock controller to use for DAO contract");
      }
    }

  // TODO dep: add post deploy to set roles !!
  }

  return ZModulesZDAODM;
};
