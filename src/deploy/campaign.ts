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


const makeContractName = instance =>
  instance.charAt(0).toUpperCase() + instance.slice(1);

export const missionFactory = configs => {
  // eslint-disable-next-line guard-for-in
  for (const instanceName in configs) {
    try {
      if (!configs) {
        throw new Error(`Configuration for ${instanceName} not found`);
      }

      // eslint-disable-next-line guard-for-in
      for (const config of configs[instanceName]) {
        const contractName = makeContractName(instanceName);
        const module = require(`./missions/${instanceName}.mission`);

        const functionName = `${instanceName}Mission`;

        if (module[functionName]) {
          return module[functionName](config, contractName, instanceName);
        } else {
          throw new Error(`Function ${functionName} not found in module ${instanceName}.mission`);
        }
      }
    } catch (error) {
      throw new Error(`Error loading module ${instanceName}`);
    }
  }
};

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