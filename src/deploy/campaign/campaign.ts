import { IZModulesConfig, IZModulesContracts } from "./types";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  DeployCampaign,
  HardhatDeployer,
  TDeployMissionCtor,
  getLogger,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getZModulesMongoAdapter } from "../mongo";


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

  // TODO dep: update this and pass ENV vars as parameters to this function !!!
  const logger = getLogger({
    silence: process.env.SILENT_LOGGER === "true",
  });

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
