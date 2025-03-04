import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  IZModulesConfig,
  IStakingERC20Config,
  IZModulesContracts,
  IVotingERC20Config,
} from "../../campaign/types";
import { contractNames } from "../../contract-names";
import { roles } from "../../constants";


export class ZModulesStakingERC20DM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = contractNames.stakingERC20.contract;
  instanceName = contractNames.stakingERC20.instance;

  hasMinter ?: boolean;
  hasBurner ?: boolean;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      config: {
        stakingERC20Config,
      },
      mockErc20STK,
      mockErc20REW,
      votingErc20,
    } = this.campaign;

    let {
      stakingToken,
      rewardsToken,
      // eslint-disable-next-line prefer-const
      mockTokens,
    } = stakingERC20Config as IStakingERC20Config;

    const {
      rewardsPerPeriod,
      periodLength,
      minimumLockTime,
      contractOwner,
      minimumRewardsMultiplier,
      maximumRewardsMultiplier,
      canExit,
    } = stakingERC20Config as IStakingERC20Config;

    if (mockTokens && mockErc20STK && mockErc20REW) {
      stakingToken = await mockErc20STK.getAddress();
      rewardsToken = await mockErc20REW.getAddress();
    } else {
      if (!stakingToken || !rewardsToken) {
        throw new Error("Must provide Staking and Reward tokens if not mocking");
      }
    }

    return [
      contractOwner,
      stakingToken,
      rewardsToken,
      await votingErc20.getAddress(),
      {
        timestamp: Math.floor(Date.now() / 1000),
        rewardsPerPeriod,
        periodLength,
        minimumLockTime,
        minimumRewardsMultiplier,
        maximumRewardsMultiplier,
        canExit,
      },
    ];
  }

  async needsPostDeploy () : Promise<boolean> {
    const {
      votingErc20,
      [this.instanceName]: staking20,
    } = this.campaign;

    const stakingAddress = await staking20.getAddress();

    this.hasMinter = await votingErc20.hasRole(roles.voting.MINTER_ROLE, stakingAddress);
    this.hasBurner = await votingErc20.hasRole(roles.voting.BURNER_ROLE, stakingAddress);

    const needs =
      !this.hasMinter ||
      !this.hasBurner;

    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs;
  }

  async postDeploy () {
    const {
      votingErc20,
      [this.instanceName]: staking20,
      config: {
        votingERC20Config,
        stakingERC20Config,
      },
    } = this.campaign;

    const {
      admin,
    } = votingERC20Config as IVotingERC20Config;

    const {
      shouldRevokeAdminRole,
    } = stakingERC20Config as IStakingERC20Config;

    const stakingAddress = await staking20.getAddress();

    this.logger.debug("Setting up roles on VotingERC20 contract");

    if (!this.hasMinter) await votingErc20.connect(admin).grantRole(roles.voting.MINTER_ROLE, stakingAddress);
    if (!this.hasBurner) await votingErc20.connect(admin).grantRole(roles.voting.BURNER_ROLE, stakingAddress);

    // revoke admin role after granting minter and burner roles
    if (shouldRevokeAdminRole) {
      await votingErc20.connect(admin).revokeRole(roles.voting.DEFAULT_ADMIN_ROLE, admin.address);
      this.logger.debug("VotingERC20 DEFAULT_ADMIN_ROLE revoked successfully");
    }
  }
}
