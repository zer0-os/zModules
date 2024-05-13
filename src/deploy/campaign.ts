import { IZModulesContracts } from "./types.campaign";
import * as hre from "hardhat";
import { HardhatEthersSigner, SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  DeployCampaign,
  HardhatDeployer,
  IDeployCampaignConfig,
  IProviderBase,
  getLogger,
} from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ZModulesStakingERC20DM, ZModulesStakingERC721DM } from "./missions";

export const runCampaign = async ({
  config,
  deployer,
} : {
  config : IDeployCampaignConfig<HardhatEthersSigner>;
  deployer ?: HardhatDeployer<HardhatRuntimeEnvironment, SignerWithAddress, IProviderBase>;
}) => {

  // TODO: Fix this when removing provider in zDC.
  const provider = {
    waitForTransaction: async () =>
      (Promise.resolve({
        contractAddress: "0x123456789",
      })),
  };

  if (!deployer) {
    deployer = new HardhatDeployer({
      hre,
      signer: config.deployAdmin,
      env: config.env,
      // TODO:  Make it optional in zDC.
      provider,
    });
  }

  const campaign = new DeployCampaign<
  HardhatRuntimeEnvironment,
  SignerWithAddress,
  IProviderBase,
  IZModulesContracts
  >({
    missions: [
      ZModulesStakingERC20DM,
      ZModulesStakingERC721DM,
    ],
    deployer,
    dbAdapter,
    logger: await getLogger(),
    config,
  });

  await campaign.execute();

  return campaign;
};