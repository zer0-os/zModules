/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DCConfig, IERC721DeployArgs, IZModulesContracts } from "../types.campaign";

export const stakingERC721Mission = (_contractName : string, _instanceName : string, localDBName ?: string) => {
  class ZModulesStakingERC721DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
  > {

    proxyData = {
      isProxy: false,
    };

    contractName = _contractName;
    instanceName = _instanceName;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        stakingERC721Config,
        mockTokens,
      } = this.campaign.config as DCConfig;

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

      if (mockTokens === true) {
        return [
          name,
          symbol,
          baseUri,
          await this.campaign.state.contracts.mockERC721.getAddress(),
          await this.campaign.state.contracts.mockERC20.getAddress(),
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