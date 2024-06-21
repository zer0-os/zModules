import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesContracts } from "../types.campaign";

export const stakingERC721Mission = (name : string, instance : string, localDBName ?: string) => {
  class ZModulesStakingERC721DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
  > {

    proxyData = {
      isProxy: false,
    };

    contractName = name;
    instanceName = instance;

    async deployArgs () : Promise<TDeployArgs> {

      const contractConfig = this.campaign.config.stakingERC721Config;

      if (
        process.env.MOCK_TOKENS === "true" &&
      (
        !contractConfig.stakingToken &&
        !contractConfig.rewardsToken
      )
      ) {
        const {
          config: {
            stakingERC721Config: {
              name,
              symbol,
              baseUri,
              rewardsPerPeriod,
              periodLength,
              timeLockPeriod,
              contractOwner,
            },
          },
        } = this.campaign;

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
      } else if (process.env.MOCK_TOKENS === "false" ||
        (
          contractConfig.stakingToken &&
          contractConfig.rewardsToken
        )
      ) {
        return Object.values(this.campaign.config.stakingERC721Config);
      }
    }
  }
  return ZModulesStakingERC721DM;
};