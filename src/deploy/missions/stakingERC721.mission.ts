/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IERC721DeployArgs, IZModulesContracts } from "../types.campaign";


export const stakingERC721Mission = (_contractName : string, _instanceName : string) => {
  class ZModulesStakingERC721DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  > {
    proxyData = {
      isProxy: false,
    };

    contractName = _contractName;
    instanceName = _instanceName;

    async deployArgs () : Promise<TDeployArgs> {
      const {
        config: {
          stakingERC721Config,
          mocks: { mockTokens },
        },
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

      if (mockTokens === true && (!stakingToken && !rewardsToken)) {
        return [
          name,
          symbol,
          baseUri,
          // TODO dep: figure out proper names here for mocks !
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