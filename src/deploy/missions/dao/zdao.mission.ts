import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IDAOConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";


export class ZModulesZDAODM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = contractNames.dao.contract;
  instanceName = contractNames.dao.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      config: {
        daoConfig,
        mock,
      },
      mockToken,
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

    if (mock && !token) {
      return [
        governorName,
        await mockToken.getAddress(),
        timelock,
        votingDelay,
        votingPeriod,
        proposalThreshold,
        quorumPercentage,
        voteExtension,
      ];
    } else if (mock && !timelock) {
      return [
        governorName,
        token,
        await mockTimelock.getAddress(),
        votingDelay,
        votingPeriod,
        proposalThreshold,
        quorumPercentage,
        voteExtension,
      ];
    } else if (mockTimelock && mock) {
      return [
        governorName,
        await mockToken.getAddress(),
        await mockTimelock.getAddress(),
        votingDelay,
        votingPeriod,
        proposalThreshold,
        quorumPercentage,
        voteExtension,
      ];
    } else {
      if (!token) {
        throw new Error("Must provide token to use for Match contract if not mocking");
      }
      return [
        governorName,
        token,
        timelock,
        votingDelay,
        votingPeriod,
        proposalThreshold,
        quorumPercentage,
        voteExtension,
      ];
    }
  }

  // TODO dep: add post deploy to set roles !!
}
