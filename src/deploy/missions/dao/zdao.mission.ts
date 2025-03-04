import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IDAOConfig, ITimelockConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import { contractNames } from "../../contract-names";
import { roles } from "../../constants";


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

  hasAdmin ?: boolean;
  hasProposer ?: boolean;
  hasExecutor ?: boolean;
  hasCanceller ?: boolean;

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
    } = daoConfig as IDAOConfig;

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
        timeLockConfig,
        daoConfig,
      },
      zDao,
      timelockController,
      deployer,
    } = this.campaign;

    const {
      admin,
    } = timeLockConfig as ITimelockConfig;

    const {
      timelockController: timelockControllerAddress,
    } = daoConfig as IDAOConfig;

    const timelockControllerContract = !timelockController
      ? await deployer.getContractObject(contractNames.timelock.contract, timelockControllerAddress!)
      : timelockController;

    const {
      DEFAULT_ADMIN_ROLE,
      PROPOSER_ROLE,
      EXECUTOR_ROLE,
      CANCELLER_ROLE,
    } = roles.timelock;

    this.hasAdmin = await timelockControllerContract.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
    this.hasProposer = await timelockControllerContract.hasRole(PROPOSER_ROLE, zDao.target);
    this.hasExecutor = await timelockControllerContract.hasRole(EXECUTOR_ROLE, zDao.target);
    this.hasCanceller = await timelockControllerContract.hasRole(CANCELLER_ROLE, zDao.target);

    const needs =
        !this.hasAdmin ||
        !this.hasProposer ||
        !this.hasExecutor ||
        !this.hasCanceller;

    this.logger.debug(`${this.contractName} ${needs ? "needs" : "doesn't need"} post deploy sequence`);

    return needs;
  }

  async postDeploy () : Promise<void> {
    const {
      config: {
        timeLockConfig,
        daoConfig,
      },
      zDao,
      timelockController,
      deployer,
    } = this.campaign;

    const {
      admin,
    } = timeLockConfig as ITimelockConfig;

    const {
      timelockController: timelockControllerAddress,
      shouldRevokeAdminRole,
    } = daoConfig as IDAOConfig;

    const timelockControllerContract = !timelockController
      ? await deployer.getContractObject(contractNames.timelock.contract, timelockControllerAddress!)
      : timelockController;

    const {
      DEFAULT_ADMIN_ROLE,
      PROPOSER_ROLE,
      EXECUTOR_ROLE,
      CANCELLER_ROLE,
    } = roles.timelock;

    this.logger.debug("Granting Proposer and Executor roles to admin");

    if (!this.hasAdmin) await timelockControllerContract.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, admin.address);
    if (!this.hasProposer) await timelockControllerContract.connect(admin).grantRole(PROPOSER_ROLE, zDao.target);
    if (!this.hasExecutor) await timelockControllerContract.connect(admin).grantRole(EXECUTOR_ROLE, zDao.target);
    if (!this.hasCanceller) await timelockControllerContract.connect(admin).grantRole(CANCELLER_ROLE, zDao.target);

    // revoke admin role after granting procoser and executor roles
    if (shouldRevokeAdminRole) {
      await timelockControllerContract.connect(admin).revokeRole(DEFAULT_ADMIN_ROLE, admin.address);
      this.logger.debug("TimelockController admin role revoked successfully");
    }
  }
}
