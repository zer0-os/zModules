import { DCConfig, IZModulesContracts } from "./types.campaign";
import * as hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  DeployCampaign,
  HardhatDeployer,
  IProviderBase,
  TDeployMissionCtor,
  getLogger,
  getMongoAdapter,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export const runCampaign = async ({
  config,
  deployer,
  missions,
} : {
  config : DCConfig;
  deployer ?: HardhatDeployer<HardhatRuntimeEnvironment, SignerWithAddress, IProviderBase>;
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

  const dbAdapter = await getMongoAdapter({
    logger,
  });

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

  return campaign;
};