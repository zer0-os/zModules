import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IERC721DeployArgs, IZModulesContracts } from "../types.campaign";


export const stakingERC20Mission = (_contractName : string, _instanceName : string) => {
  class ZModulesStakingERC20DM extends BaseDeployMission<
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
          stakingERC20Config,
          mocks: { mockTokens },
        },
      } = this.campaign;

      const {
        stakingToken,
        rewardsToken,
        rewardsPerPeriod,
        periodLength,
        timeLockPeriod,
        contractOwner,
      } = stakingERC20Config as IERC721DeployArgs;

      if (mockTokens === true && (!stakingToken && !rewardsToken)) {
        return [
          // TODO dep: error here in naming! the name of token contract is assumed and not guaranteed!
          await this.campaign.state.contracts.mockERC20.getAddress(),
          await this.campaign.state.contracts.mockERC20Second.getAddress(),
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