/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { contractNames } from "../../contract-names";
import {
  ZModulesConfig,
  IZModulesContracts,
  IStakingERC721DeployArgs,
  IVotingERC721DeployArgs,
} from "../../campaign/types";


export const getStakingERC721Mission = (_instanceName ?: string) => {
  class ZModulesStakingERC721DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = contractNames.stakingERC721.contract;
    instanceName = !_instanceName ? contractNames.stakingERC721.instance : _instanceName;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        config: {
          stakingERC721Config,
          mockTokens,
        },
        mockErc721STK,
        mockErc721REW,
        votingErc721,
      } = this.campaign;

      let {
        stakingToken,
        rewardsToken,
      } = stakingERC721Config as IStakingERC721DeployArgs;

      const {
        rewardsPerPeriod,
        periodLength,
        minimumLockTime,
        contractOwner,
        minimumRewardsMultiplier,
        maximumRewardsMultiplier,
      } = stakingERC721Config as IStakingERC721DeployArgs;

      if (mockTokens) {
        stakingToken = await mockErc721STK.getAddress();
        rewardsToken = await mockErc721REW.getAddress();
      } else {
        if (!stakingToken || !rewardsToken) {
          throw new Error("Must provide Staking and Reward tokens if not mocking");
        }
      }

      return [
        {
          stakingToken,
          rewardsToken,
          stakeRepToken: await votingErc721.getAddress(),
          rewardsPerPeriod,
          periodLength,
          minimumLockTime,
          contractOwner,
          minimumRewardsMultiplier,
          maximumRewardsMultiplier,
        },
      ];
    }

    async needsPostDeploy () : Promise<boolean> {
      const {
        votingErc721,
        [this.instanceName]: staking721,
      } = this.campaign;

      const stakingAddress = await staking721.getAddress();

      const hasMinter = await votingErc721.hasRole(await votingErc721.MINTER_ROLE(), stakingAddress);
      const hasBurner = await votingErc721.hasRole(await votingErc721.BURNER_ROLE(), stakingAddress);

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
      } = votingERC721Config as IVotingERC721DeployArgs;

      const stakingAddress = await staking721.getAddress();

      await votingErc721
        .connect(admin)
        .grantRole(await votingErc721.MINTER_ROLE(), stakingAddress);

      await votingErc721
        .connect(admin)
        .grantRole(await votingErc721.BURNER_ROLE(), stakingAddress);
    }
  }

  return ZModulesStakingERC721DM;
};
