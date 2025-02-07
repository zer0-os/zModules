import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IDAOConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";
import { roles } from "../../constants";


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
        votingErc20,
        votingErc721,
        timelockController,
      } = this.campaign;

      if (votingErc20 && votingErc721) {
        throw new Error("Both votingERC20 and votingERC721 tokens are provided. Only one token should be specified.");
      } else if (!votingErc20 && !votingErc721) {
        throw new Error("No voting token provided.");
      }

      const votingToken = votingErc20 || votingErc721;

      const {
        shouldRevokeAdminRole,
        governorName,
        votingDelay,
        votingPeriod,
        proposalThreshold,
        quorumPercentage,
        voteExtension,
      } = daoConfig as IDAOConfig;

      if (!timelockController) throw new Error("Must provide Timelock Controller address");

      if (votingToken && timelockController) {
        return [
          governorName,
          votingToken.target,
          timelockController.target,
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

      const {
        DEFAULT_ADMIN_ROLE,
        PROPOSER_ROLE,
        EXECUTOR_ROLE,
      } = roles.timelock;

      const needs =
        !await timelockController.hasRole(DEFAULT_ADMIN_ROLE, deployAdmin.address) ||
        !await timelockController.hasRole(PROPOSER_ROLE, zDao.target) ||
        !await timelockController.hasRole(EXECUTOR_ROLE, zDao.target);

      this.logger.debug(`${this.contractName} ${needs ? "needs" : "doesn't need"} post deploy sequence`);

      return needs;
    }

    // TODO dep: add admin renouncing logic that is turned on by a ENV var !!!
    //  do it for Voting tokens as well !!!
    async postDeploy () : Promise<void> {
      const {
        config: {
          deployAdmin,
        },
        zDao,
        timelockController,
      } = this.campaign;

      const {
        shouldRevokeAdminRole,
      } = this.campaign.config.daoConfig as IDAOConfig;

      const {
        DEFAULT_ADMIN_ROLE,
        PROPOSER_ROLE,
        EXECUTOR_ROLE,
      } = roles.timelock;

      await timelockController.grantRole(DEFAULT_ADMIN_ROLE, deployAdmin.address);
      await timelockController.grantRole(PROPOSER_ROLE, zDao.target);
      await timelockController.grantRole(EXECUTOR_ROLE, zDao.target);

      // revoke admin role after granting procoser and executor roles
      if (shouldRevokeAdminRole) await timelockController.revokeRole(DEFAULT_ADMIN_ROLE, deployAdmin.address);
    }
  }

  return ZModulesZDAODM;
};
