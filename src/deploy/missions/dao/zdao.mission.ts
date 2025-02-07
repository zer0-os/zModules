import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IDAOConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";


export const getDAOMission = () => {
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
    instanceName = contractNames.dao.instance;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        config: {
          daoConfig,
        },
        mockVotingToken,
      } = this.campaign;

      let {
        votingToken,
        timelockController,
      } = daoConfig as IDAOConfig;
      const {
        mockTokens,
        governorName,
        votingDelay,
        votingPeriod,
        proposalThreshold,
        quorumPercentage,
        voteExtension,
      } = daoConfig as IDAOConfig;

      timelockController = timelockController || this.campaign.state.contracts[contractNames.timelock.instance].target;

      if (!timelockController) throw new Error("Must provide Timelock Controller address");

      if (mockTokens) {
        votingToken = await mockVotingToken.getAddress();
      } else {
        if (!votingToken) {
          throw new Error("Must provide Voting token if not mocking");
        }
      }

      if (
        (votingToken || mockVotingToken) &&
        (timelockController)
      ) {
        return [
          governorName,
          votingToken ? votingToken : await mockVotingToken.getAddress(),
          timelockController,
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

    async needsPostDeploy () : Promise<boolean> {
      const {
        config: {
          deployAdmin,
        },
        zDao,
        timelockController,
      } = this.campaign;

      const adminRole = await timelockController.DEFAULT_ADMIN_ROLE();
      const proposerRole = await timelockController.PROPOSER_ROLE();
      const executorRole = await timelockController.EXECUTOR_ROLE();

      const hasAdmin = await timelockController.hasRole(adminRole, deployAdmin.address);
      const hasMinter = await timelockController.hasRole(proposerRole, zDao.target);
      const hasBurner = await timelockController.hasRole(executorRole, zDao.target);

      const needs = !hasMinter || !hasBurner || !hasAdmin;
      const msg = needs ? "needs" : "doesn't need";

      this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

      return needs;
    }

    async postDeploy () : Promise<void> {
      const {
        config: {
          deployAdmin,
        },
        zDao,
        timelockController,
      } = this.campaign;

      const adminRole = await timelockController.DEFAULT_ADMIN_ROLE();
      const proposerRole = await timelockController.PROPOSER_ROLE();
      const executorRole = await timelockController.EXECUTOR_ROLE();

      await timelockController.grantRole(adminRole, deployAdmin.address);
      await timelockController.grantRole(proposerRole, zDao.target);
      await timelockController.grantRole(executorRole, zDao.target);
    }
  }

  return ZModulesZDAODM;
};
