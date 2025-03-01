import { IZModulesConfig, IZModulesContracts } from "./types";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  DeployCampaign,
  HardhatDeployer,
  TDeployMissionCtor,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getZModulesLogger, getZModulesMongoAdapter } from "../mongo";


export const runZModulesCampaign = async ({
  config,
  deployer,
  dbVersion,
  missions,
} : {
  config : IZModulesConfig;
  deployer ?: HardhatDeployer<HardhatRuntimeEnvironment, SignerWithAddress>;
  dbVersion ?: string;
  missions : Array<TDeployMissionCtor<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
  IZModulesContracts
  >>;
}) => {

  if (!deployer) {
    deployer = new HardhatDeployer({
      hre,
      signer: config.deployAdmin,
      env: config.env,
      confirmationsN: config.confirmationsN,
    });
  }

  const logger = await getZModulesLogger();

  const dbAdapter = await getZModulesMongoAdapter();

  const campaign = new DeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IZModulesConfig,
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
