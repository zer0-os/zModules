/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IERC721DeployArgs, IZModulesContracts } from "../types.campaign";

export const stakingERC721Mission = (args : IERC721DeployArgs, _contractName : string, _instanceName : string) => {
  class ZModulesStakingERC721DM extends BaseDeployMission<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
  > {

    proxyData = {
      isProxy: false,
    };

    async execute () : Promise<void> {
      this.args = await this.deployArgs();

      await super.execute();
    }

    contractName = _contractName;
    instanceName = _instanceName;

    async deployArgs () : Promise<TDeployArgs> {
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
      } = args;

      if (this.campaign.config.mockTokens === true
        && (!stakingToken && !rewardsToken)
      ) {
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
          ...Object.values(args) as TDeployArgs,
        ];
      }
    }
  }
  return ZModulesStakingERC721DM;
};