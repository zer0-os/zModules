import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IERC721DeployArgs, IZModulesContracts } from "../types.campaign";
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
      } = this.campaign;

      const {
        stakingToken,
        rewardsToken,
        rewardsPerPeriod,
        periodLength,
        timeLockPeriod,
        contractOwner,
      } = stakingERC20Config as IERC721DeployArgs;

      if (mockTokens && (!stakingToken && !rewardsToken)) {
        return [
          await mock20STK.getAddress(),
          await mock20REW.getAddress(),
          rewardsPerPeriod,
          periodLength,
          timeLockPeriod,
          contractOwner,
        ];
      } else {
        if (!stakingToken || !rewardsToken) {
          throw new Error("Must provide Staking and Reward tokens if not mocking");
        }

        return [
          stakingToken,
          rewardsToken,
          rewardsPerPeriod,
          periodLength,
          timeLockPeriod,
          contractOwner,
        ];
      }
    }
  }

  return ZModulesStakingERC20DM;
};