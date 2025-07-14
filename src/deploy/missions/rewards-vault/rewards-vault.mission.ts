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

  operatorsToSet ?: Array<string> = [];

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
        deployAdmin,
        rewardsVaultConfig,
      },
      zeroRewardsVault,
    } = this.campaign;

    if (!rewardsVaultConfig)
      throw new Error("Rewards Vault config is not defined!");

    const {
      operators,
    } = rewardsVaultConfig;

    let needs = false;
    if (!operators || operators.length !== 0) {
      for (const operator of operators) {
        if (!await zeroRewardsVault.connect(deployAdmin).isOperator(operator)) {
          this.operatorsToSet?.push(operator);
          needs = true;
        }
      }
    }

    return needs; // If no operators are defined, no post-deploy needed
  }

  async postDeploy () : Promise<void> {
    const {
      config: {
        deployAdmin,
        rewardsVaultConfig,
      },
      zeroRewardsVault,
    } = this.campaign;

    if (!rewardsVaultConfig)
      throw new Error("Rewards Vault config is not defined!");

    const {
      owner,
    } = rewardsVaultConfig;

    if (!this.operatorsToSet || this.operatorsToSet.length === 0)
      throw new Error("Operators are not defined!");

    for (const operator of this.operatorsToSet)
      await zeroRewardsVault.connect(deployAdmin).addOperator(operator);

    await zeroRewardsVault.connect(deployAdmin).transferOwnership(owner);
  }
}
