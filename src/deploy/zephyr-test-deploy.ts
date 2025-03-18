import * as hre from "hardhat";
import fs from "fs";
import path from "path";
import {
  getStaking20SystemConfig,
  getStaking721SystemConfig,
} from "./campaign/staking-system-config";
import {
  IZModulesConfig,
  IZModulesContracts,
} from "./campaign/types";
import { DeployCampaign } from "@zero-tech/zdc";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { runZModulesCampaign } from "./campaign/campaign";
import {
  getDao20SystemConfig,
  getDao721SystemConfig,
} from "./campaign/dao-system-config";
import { ZModulesZeroVotingERC20DM } from "./missions/voting-erc20/voting20.mission";
import { ZModulesZeroVotingERC721DM } from "./missions/voting-erc721/voting721.mission";
import { ZModulesTimelockControllerDM } from "./missions/dao/timelock.mission";
import { ZModulesZDAODM } from "./missions/dao/zdao.mission";
import { getZModulesLogger } from "./mongo";
import { ZModulesStakingERC20DM } from "./missions/staking-erc20/staking20.mission";
import { ZModulesStakingERC721DM } from "./missions/staking-erc721/staking721.mission";
import { getMockERC20Mission, TokenTypes } from "./missions/mocks/mockERC20.mission";
import { getBaseZModulesConfig } from "./campaign/base-campaign-config";
import { getMockERC721Mission } from "./missions/mocks/mockERC721.mission";


let config : IZModulesConfig;
let campaign : DeployCampaign<
HardhatRuntimeEnvironment,
SignerWithAddress,
IZModulesConfig,
IZModulesContracts>;

const mockDeploy = async () => {
  config = await getBaseZModulesConfig();

  campaign = await runZModulesCampaign({
    config,
    missions: [
      getMockERC20Mission({
        tokenType: TokenTypes.staking,
        tokenName: "Staking Token",
        tokenSymbol: "STK",
      }),
      getMockERC20Mission({
        tokenType: TokenTypes.rewards,
        tokenName: "Rewards Token",
        tokenSymbol: "RWD",
      }),
      getMockERC721Mission({
        tokenType: TokenTypes.staking,
        tokenName: "Staking Token",
        tokenSymbol: "STK",
        baseUri: "0://NFT/",
      }),
    ],
  });
};

const stakingDeploy = async (is721 : boolean) => {
  const [ deployAdmin, fWallet, user2 ] = await hre.ethers.getSigners();

  if (!is721) {
    process.env.STAKING20_REWARDS_PER_PERIOD = "100";
    process.env.STAKING20_PERIOD_LENGTH = "30";
    process.env.STAKING20_MIN_LOCK_TIME = "0";
    process.env.STAKING20_CAN_EXIT = "true";
    process.env.TIMELOCK_VOTING_TOKEN_TYPE = "20";

    config = await getStaking20SystemConfig(user2, deployAdmin, fWallet);

    campaign = await runZModulesCampaign({
      config,
      missions: [
        ZModulesZeroVotingERC20DM,
        ZModulesStakingERC20DM,
      ],
    });
  } else {
    process.env.STAKING721_REWARDS_PER_PERIOD = "1";
    process.env.STAKING721_PERIOD_LENGTH = "30";
    process.env.STAKING721_MIN_LOCK_TIME = "60";
    process.env.STAKING721_CAN_EXIT = "true";
    process.env.TIMELOCK_VOTING_TOKEN_TYPE = "721";

    config = await getStaking721SystemConfig(user2, deployAdmin, fWallet);

    campaign = await runZModulesCampaign({
      config,
      missions: [
        ZModulesZeroVotingERC721DM,
        ZModulesStakingERC721DM,
      ],
    });
  }
};

const daoDeploy = async (is721 : boolean) => {
  const [ deployAdmin, fWallet, user2 ] = await hre.ethers.getSigners();

  if (!is721) {
    config = await getDao20SystemConfig(user2, fWallet, deployAdmin);

    campaign = await runZModulesCampaign({
      config,
      missions: [
        ZModulesTimelockControllerDM,
        ZModulesZDAODM,
      ],
    });
  } else {
    config = await getDao721SystemConfig(user2, fWallet, deployAdmin);

    campaign = await runZModulesCampaign({
      config,
      missions: [
        ZModulesTimelockControllerDM,
        ZModulesZDAODM,
      ],
    });
  }
};

const logger = getZModulesLogger({
  logLevel: "debug",
  makeLogFile: process.env.MAKE_LOG_FILE === "true",
  silence: process.env.SILENT_LOGGER === "true",
});

const loadAbiAndInterface = (contractName : string) => {
  let abiPath;
  if (contractName === "Staking20") {
    abiPath = path.resolve("artifacts/contracts/staking/ERC20/StakingERC20.sol/StakingERC20.json");
  } else if (contractName === "Staking721") {
    abiPath = path.resolve("artifacts/contracts/staking/ERC721/StakingERC721.sol/StakingERC721.json");
  } else if (contractName === "DAO") {
    abiPath = path.resolve("artifacts/contracts/dao/ZDAO.sol/ZDAO.json");
  }
  if (!abiPath) logger.error("Deploy Helper: Couldn't find the contract ABI file");

  const contractJson = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  const abi = contractJson.abi;
  return new hre.ethers.Interface(abi);
};

// Changed the order of the deployQueue to match the order of the deploy functions
const deployQueue = [
  { name: "MockDeploy", func: async () => mockDeploy() },
  { name: "Staking20", func: async () => stakingDeploy(true) },
  { name: "Staking721", func: async () => stakingDeploy(false) },
];

// Call this to run the deployment
export const runDeploy = async () => {
  for (const task of deployQueue) {
    try {
      await task.func();
    } catch (error) {
      const iface = loadAbiAndInterface(task.name);
      const errorHash = error.data;
      const decodedErr = iface.parseError(errorHash);

      if (decodedErr) {
        logger.error(`Deploy Helper: Custom error #${error.message}: ${decodedErr.name}; Args: ${decodedErr.args}`);
      } else {
        logger.error(`Deploy Helper: Couldn't decode the error! ${error}; ${errorHash}`);
      }
      process.exit(1);
    }
  }
  logger.info("Deploy Helper: Deployment finished");
  process.exit(0);
};