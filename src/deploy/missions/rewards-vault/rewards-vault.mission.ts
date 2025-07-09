import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IZModulesContracts } from "../../campaign/types";


export class ZModulesRewardsVaultDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = "ZeroRewardsVault";
  instanceName = "zeroRewardsVault";

  async deployArgs () : Promise<TDeployArgs> {
    const {
      config: {
        rewardsVaultConfig,
      },
    } = this.campaign;

    if (
      !rewardsVaultConfig ||
      !rewardsVaultConfig.token ||
      !rewardsVaultConfig.owner
    ) throw new Error("Not enough input data to deploy Rewards Vault!");

    return [
      rewardsVaultConfig.owner,
      rewardsVaultConfig.token,
    ];
  }

  async needsPostDeploy () : Promise<boolean> {
    return true;
  }

  async postDeploy () : Promise<void> {
    const {
      config: {
        rewardsVaultConfig: {
          operators,
        },
      },
      zeroRewardsVault,
    } = this.campaign;

    if (!zeroRewardsVault) {
      throw new Error("Rewards Vault contract is not deployed!");
    }

    if (!operators || operators.length === 0) {
      throw new Error("Operators are not defined!");
    }

    for (const operator of operators) {
      await zeroRewardsVault.addOperator(operator);
    }
  }
}
