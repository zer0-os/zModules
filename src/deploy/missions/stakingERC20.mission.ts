import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  IProviderBase,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IERC20DeployArgs, IZModulesContracts } from "../types.campaign";
import { ethers } from "ethers";


export const stakingERC20Mission = (args : IERC20DeployArgs, _contractName : string, _instanceName : string) => {

  class ZModulesStakingERC20DM extends BaseDeployMission<
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
        stakingToken,
        rewardsToken,
      } = args ;

      if (this.campaign.config.mockTokens === true
        && (!stakingToken && !rewardsToken)
      ) {
        return [
          await this.campaign.state.contracts.mockERC20.getAddress(),
          await this.campaign.state.contracts.mockERC20Second.getAddress(),
          // TODO myself: double check types
          ...Object.values(args) as TDeployArgs,
        ];

      } else {
        if (!stakingToken || !rewardsToken) {
          throw new Error("Must provide Staking and Reward tokens if not mocking");
        }

        // TODO myself: double check types
        return [
          ...Object.values(args) as TDeployArgs,
        ];
      }
    }

    async getFromDB () {
      const contracts = await this.campaign.dbAdapter.getContracts(this.contractName);

      if (contracts !== null) {
        for (const contract of contracts) {
          if (contract.args === this.args) {
            return contract;
          } else return null;
        }
      } else return contracts;
    }
  }
  return ZModulesStakingERC20DM;
};