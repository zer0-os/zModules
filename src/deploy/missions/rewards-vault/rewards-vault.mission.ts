import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BaseDeployMission, TDeployArgs } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IRewardsVaultConfig, IZModulesConfig, IZModulesContracts } from "../../campaign/types";


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
        deployAdmin,
        rewardsVaultConfig,
      },
    } = this.campaign;

    if (!rewardsVaultConfig)
      throw new Error("Not enough input data to deploy Rewards Vault!");

    return [
      deployAdmin.address,
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

    const {
      owner,
    } = rewardsVaultConfig as IRewardsVaultConfig;

    if (!this.operatorsToSet || this.operatorsToSet.length === 0)
      throw new Error("No operators to set! Error in needsPostDeploy.");

    for (const operator of this.operatorsToSet)
      await zeroRewardsVault.connect(deployAdmin).addOperator(operator);

    await zeroRewardsVault.connect(deployAdmin).transferOwnership(owner);
  }
}
