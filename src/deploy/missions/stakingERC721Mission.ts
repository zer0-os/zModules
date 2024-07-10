/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IERC721DeployArgs, IZModulesContracts } from "../types.campaign";
import { contractNames } from "../contractNames";


export const getStakingERC721Mission = () => {
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
    instanceName = contractNames.stakingERC721.instance;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        config: {
          stakingERC721Config,
          mocks: { mockTokens },
        },
        mock20REW,
        mock721,
      } = this.campaign;

      const {
        name,
        symbol,
        baseUri,
        stakingToken,
        rewardsToken,
        rewardsPerPeriod,
        periodLength,
        timeLockPeriod,
        contractOwner,
      } = stakingERC721Config as IERC721DeployArgs;

      if (mockTokens && (!stakingToken && !rewardsToken)) {
        return [
          name,
          symbol,
          baseUri,
          await mock721.getAddress(),
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
          name,
          symbol,
          baseUri,
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

  return ZModulesStakingERC721DM;
};