import { DCConfig, IZModulesContracts } from "./types.campaign";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  DeployCampaign,
  HardhatDeployer,
  IProviderBase,
  TDeployMissionCtor,
  getLogger,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getZModulesMongoAdapter } from "./mongo";

export const runZModulesCampaign = async ({
  config,
  deployer,
  dbVersion,
  missions,
} : {
  config : DCConfig;
  deployer ?: HardhatDeployer<HardhatRuntimeEnvironment, SignerWithAddress, IProviderBase>;
  dbVersion ?: string;
  missions : Array<TDeployMissionCtor<HardhatRuntimeEnvironment, SignerWithAddress, IProviderBase, IZModulesContracts>>;
}) => {

  if (!deployer) {
    deployer = new HardhatDeployer({
      hre,
      signer: config.deployAdmin,
      env: config.env,
    });
  }

  const logger = await getLogger();

  const dbAdapter = await getZModulesMongoAdapter();

  const campaign = new DeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
  >({
    missions,
    deployer,
    dbAdapter,
    logger,
    config,
  });

  await campaign.execute();

  await dbAdapter.finalize(dbVersion);

  return campaign;
};