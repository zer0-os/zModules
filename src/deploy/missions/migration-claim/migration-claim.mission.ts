import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  BaseDeployMission,
  TDeployArgs,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  IZModulesConfig,
  IZModulesContracts,
  IMigrationClaimConfig,
} from "../../campaign/types";
import { contractNames } from "../../contract-names";


export class MigrationClaimDM extends BaseDeployMission<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts
> {
  proxyData = {
    isProxy: false,
  };

  contractName = contractNames.migrationClaim.contract;
  instanceName = contractNames.migrationClaim.instance;

  async deployArgs () : Promise<TDeployArgs> {
    const {
      merkleRoot,
      owner,
      rewardsVault,
      wildToken,
      lpToken,
    } = this.campaign.config.migrationClaimConfig as IMigrationClaimConfig;

    return [
      merkleRoot,
      owner,
      rewardsVault,
      wildToken,
      lpToken,
    ];
  }
}
