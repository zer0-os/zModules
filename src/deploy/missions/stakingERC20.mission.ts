import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DCConfig, IERC721DeployArgs, IZModulesContracts } from "../types.campaign";


export const stakingERC20Mission = (_contractName : string, _instanceName : string) => {
  class ZModulesStakingERC20DM extends BaseDeployMission<
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
        stakingERC20Config,
        mockTokens,
      } = this.campaign.config as DCConfig;

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