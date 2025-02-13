import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IDAOConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";
import { roles } from "../../constants";
import { ethers } from "hardhat";
import * as hre from "hardhat";


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
      },
      votingErc20,
      votingErc721,
      timelockController: campaignTimelockController,
    } = this.campaign;

    if (votingErc20 && votingErc721) {
      throw new Error("Both votingERC20 and votingERC721 tokens are provided. Only one token should be specified.");
    }

    let {
      votingToken,
      timelockController,
    } = this.campaign.config.daoConfig as IDAOConfig;

    if (!timelockController) {
      timelockController = campaignTimelockController;
    }

    const {
      governorName,
      votingDelay,
      votingPeriod,
      proposalThreshold,
      quorumPercentage,
      voteExtension,
    } = daoConfig as IDAOConfig;

    if (!votingToken) votingToken = votingErc20 || votingErc721;

    if (votingToken && timelockController) {
      const votingTokenAddress =
        typeof votingToken === "string" ? votingToken : votingToken.target;
      const timelockControllerAddress =
        typeof timelockController === "string" ? timelockController : timelockController.target;

      return [
        governorName,
        votingTokenAddress,
        timelockControllerAddress,
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
      timelockController: campaignTimelockController,
    } = this.campaign;

    let {
      timelockController,
    } = this.campaign.config.daoConfig as IDAOConfig;

    if (!timelockController) {
      timelockController = campaignTimelockController;
    } else {
      timelockController = await hre.ethers.getContractAt(contractNames.timelock.contract, timelockController);
    }

    const {
      DEFAULT_ADMIN_ROLE,
      PROPOSER_ROLE,
      EXECUTOR_ROLE,
    } = roles.timelock;

    const needs =
        !await timelockController.connect(deployAdmin).hasRole(DEFAULT_ADMIN_ROLE, deployAdmin.address) ||
        !await timelockController.connect(deployAdmin).hasRole(PROPOSER_ROLE, zDao.target) ||
        !await timelockController.connect(deployAdmin).hasRole(EXECUTOR_ROLE, zDao.target);

    this.logger.debug(`${this.contractName} ${needs ? "needs" : "doesn't need"} post deploy sequence`);

    return needs;
  }

  async postDeploy () : Promise<void> {
    const {
      config: {
        deployAdmin,
      },
      zDao,
      timelockController: campaignTimelockController,
    } = this.campaign;

    let {
      timelockController,
    } = this.campaign.config.daoConfig as IDAOConfig;

    if (!timelockController) {
      timelockController = campaignTimelockController;
    } else {
      timelockController = await hre.ethers.getContractAt(contractNames.timelock.contract, timelockController);
    }

    const {
      shouldRevokeAdminRole,
    } = this.campaign.config.daoConfig as IDAOConfig;

    const {
      DEFAULT_ADMIN_ROLE,
      PROPOSER_ROLE,
      EXECUTOR_ROLE,
    } = roles.timelock;

    await timelockController.connect(deployAdmin).grantRole(DEFAULT_ADMIN_ROLE, deployAdmin.address);
    await timelockController.connect(deployAdmin).grantRole(PROPOSER_ROLE, zDao.target);
    await timelockController.connect(deployAdmin).grantRole(EXECUTOR_ROLE, zDao.target);

    // revoke admin role after granting procoser and executor roles
    if (shouldRevokeAdminRole)
      await timelockController.connect(deployAdmin).revokeRole(DEFAULT_ADMIN_ROLE, deployAdmin.address);
  }
}