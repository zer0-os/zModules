import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IZModulesConfig, IZModulesContracts } from "../../campaign/types";
import * as hre from "hardhat";

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

    if (!rewardsVaultConfig)
      throw new Error("Not enough input data to deploy Rewards Vault!");

    return [
      rewardsVaultConfig.owner,
      rewardsVaultConfig.token,
    ];
  }

  async needsPostDeploy () : Promise<boolean> {
    const {
      config: {
        rewardsVaultConfig,
      },
      zeroRewardsVault,
    } = this.campaign;

    if (!rewardsVaultConfig)
      throw new Error("Rewards Vault config is not defined!");

    const {
      owner,
    } = rewardsVaultConfig;

    const signerOwner = await hre.ethers.getSigner(owner);

    for (const operator of rewardsVaultConfig.operators) {
      if (!(await zeroRewardsVault.connect(signerOwner).isOperator(operator))) {
        return true;
      } else {
        return false; // If any operator is already set, no need for post-deploy
      }
    }

    return false; // If no operators are defined, no post-deploy needed
  }

  async postDeploy () : Promise<void> {
    const {
      config: {
        rewardsVaultConfig,
      },
      zeroRewardsVault,
    } = this.campaign;

    if (!rewardsVaultConfig)
      throw new Error("Rewards Vault config is not defined!");

    const {
      operators,
      owner,
    } = rewardsVaultConfig;

    const signerOwner = await hre.ethers.getSigner(owner);

    if (!operators || operators.length === 0)
      throw new Error("Operators are not defined!");

    for (const operator of operators)
      await zeroRewardsVault.connect(signerOwner).addOperator(operator);
  }
}
