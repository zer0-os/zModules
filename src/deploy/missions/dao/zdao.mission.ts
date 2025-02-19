import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IDAOConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";
import { roles } from "../../constants";
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
      timelockController,
    } = this.campaign;

    const {
      votingToken: votingTokenAddress,
      timelockController: timeLockControllerAddress,
    } = this.campaign.config.daoConfig as IDAOConfig;

    let votingTokenArg;
    if (votingErc20 && votingErc721) {
      // eslint-disable-next-line max-len
      throw new Error("Both votingERC20 and votingERC721 tokens are in campaign state. Only one token should be specified!");
    } else if (!votingErc20 && !votingErc721 && !votingTokenAddress) {
      throw new Error("No voting token provided for zDAO!");
    } else if (!votingErc20 && !votingErc721) {
      votingTokenArg = votingTokenAddress;
    } else if (votingErc20) {
      votingTokenArg = await votingErc20.getAddress();
    } else if (votingErc721) {
      votingTokenArg = await votingErc721.getAddress();
    }

    let timelockArg;
    if (!timelockController && !timeLockControllerAddress) {
      throw new Error("No timelock controller provided for zDAO!");
    } else if (timelockController && timeLockControllerAddress) {
      throw new Error("Both timelockController contract and address are present. Only one should be specified!");
    } else if (!timelockController) {
      timelockArg = timeLockControllerAddress;
    } else {
      timelockArg = await timelockController.getAddress();
    }

    const {
      governorName,
      votingDelay,
      votingPeriod,
      proposalThreshold,
      quorumPercentage,
      voteExtension,
    } = daoConfig as IDAOConfig;

    return [
      governorName,
      votingTokenArg,
      timelockArg,
      votingDelay,
      votingPeriod,
      proposalThreshold,
      quorumPercentage,
      voteExtension,
    ];
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
      timelockController: timelockControllerAddress,
    } = this.campaign.config.daoConfig as IDAOConfig;

    const timelockControllerContract = !timelockController
      ? await hre.ethers.getContractAt(contractNames.timelock.contract, timelockControllerAddress!)
      : timelockController;

    const {
      DEFAULT_ADMIN_ROLE,
      PROPOSER_ROLE,
      EXECUTOR_ROLE,
    } = roles.timelock;

    const needs =
        !await timelockControllerContract.connect(deployAdmin).hasRole(DEFAULT_ADMIN_ROLE, deployAdmin.address) ||
        !await timelockControllerContract.connect(deployAdmin).hasRole(PROPOSER_ROLE, zDao.target) ||
        !await timelockControllerContract.connect(deployAdmin).hasRole(EXECUTOR_ROLE, zDao.target);
    // TODO dep: add canceller role to be able to timelock.cancel()

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
