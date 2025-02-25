/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { contractNames } from "../../contract-names";
import {
  IZModulesConfig,
  IZModulesContracts,
  IStakingERC721Config,
  IVotingERC721Config,
} from "../../campaign/types";
import { roles } from "../../constants";


export class ZModulesStakingERC721DM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = contractNames.stakingERC721.contract;
  instanceName = contractNames.stakingERC721.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      config: {
        stakingERC721Config,
      },
      mockErc721STK,
      mockErc20REW,
      votingErc721,
    } = this.campaign;

    let {
      stakingToken,
      rewardsToken,
      // eslint-disable-next-line prefer-const
      mockTokens,
    } = stakingERC721Config as IStakingERC721Config;

    const {
      rewardsPerPeriod,
      periodLength,
      minimumLockTime,
      contractOwner,
      minimumRewardsMultiplier,
      maximumRewardsMultiplier,
      canExit,
    } = stakingERC721Config as IStakingERC721Config;

    if (mockTokens && mockErc721STK && mockErc20REW) {
      stakingToken = await mockErc721STK.getAddress();
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
      await votingErc721.getAddress(),
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
      votingErc721,
      [this.instanceName]: staking721,
    } = this.campaign;

    const stakingAddress = await staking721.getAddress();

    const hasMinter = await votingErc721.hasRole(roles.voting.MINTER_ROLE, stakingAddress);
    const hasBurner = await votingErc721.hasRole(roles.voting.BURNER_ROLE, stakingAddress);

    const needs = !hasMinter || !hasBurner;
    const msg = needs ? "needs" : "doesn't need";

    this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

    return needs;
  }

  async postDeploy () {
    const {
      votingErc721,
      [this.instanceName]: staking721,
      config: {
        votingERC721Config,
      },
    } = this.campaign;

    const {
      admin,
    } = votingERC721Config as IVotingERC721Config;

    const {
      shouldRevokeAdminRole,
    } = this.campaign.config.stakingERC721Config as IStakingERC721Config;

    const stakingAddress = await staking721.getAddress();

    this.logger.debug("Setting up roles on VotingERC721 contract");

    await votingErc721
      .connect(admin)
      .grantRole(roles.voting.MINTER_ROLE, stakingAddress);

    await votingErc721
      .connect(admin)
      .grantRole(roles.voting.BURNER_ROLE, stakingAddress);

    // revoke admin role after granting minter and burner roles
    if (shouldRevokeAdminRole) {
      await votingErc721.connect(admin).revokeRole(roles.voting.DEFAULT_ADMIN_ROLE, admin.address);
      this.logger.debug("VotingERC721 DEFAULT_ADMIN_ROLE revoked");
    }

    this.logger.debug("VotingERC721 roles set up successfully");
  }
}
