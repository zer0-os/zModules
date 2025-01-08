import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IERC20DeployArgs, IZModulesContracts } from "../campaign/types";
import { contractNames } from "../contractNames";


export const getStakingERC20Mission = (_instanceName ?: string) => {
  class ZModulesStakingERC20DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = contractNames.stakingERC20.contract;
    instanceName = !_instanceName ? contractNames.stakingERC20.instance : _instanceName;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        config: {
          stakingERC20Config,
          mockTokens,
        },
        mock20STK,
        mock20REW,
        votingErc20,
      } = this.campaign;

      let {
        stakingToken,
        rewardsToken,
      } = stakingERC20Config as IERC20DeployArgs;

      const {
        rewardsPerPeriod,
        periodLength,
        minimumLockTime,
        contractOwner,
        minimumRewardsMultiplier,
        maximumRewardsMultiplier,
      } = stakingERC20Config as IERC20DeployArgs;

      if (mockTokens) {
        stakingToken = await mock20STK.getAddress();
        rewardsToken = await mock20REW.getAddress();
      } else {
        if (!stakingToken || !rewardsToken) {
          throw new Error("Must provide Staking and Reward tokens if not mocking");
        }
      }

      return [
        {
          stakingToken,
          rewardsToken,
          stakeRepToken: await votingErc20.getAddress(),
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
        votingErc20,
        [this.instanceName]: staking20,
      } = this.campaign;

      const stakingAddress = await staking20.getAddress();

      const hasMinter = await votingErc20.hasRole(await votingErc20.MINTER_ROLE(), stakingAddress);
      const hasBurner = await votingErc20.hasRole(await votingErc20.BURNER_ROLE(), stakingAddress);

      const needs = !hasMinter || !hasBurner;
      const msg = needs ? "needs" : "doesn't need";

      this.logger.debug(`${this.contractName} ${msg} post deploy sequence`);

      return needs;
    }

    async postDeploy () {
      const {
        votingErc20,
        [this.instanceName]: staking20,
        config: {
          voting20Config: {
            admin,
          },
        },
      } = this.campaign;

      const stakingAddress = await staking20.getAddress();

      await votingErc20
        .connect(admin)
        .grantRole(await votingErc20.MINTER_ROLE(), stakingAddress);

      await votingErc20
        .connect(admin)
        .grantRole(await votingErc20.BURNER_ROLE(), stakingAddress);
    }
  }

  return ZModulesStakingERC20DM;
};
