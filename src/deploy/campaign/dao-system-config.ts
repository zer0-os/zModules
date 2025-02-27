import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getBaseZModulesConfig } from "./base-campaign-config";
import { getVoting20DeployConfig } from "../missions/voting-erc20/voting20.config";
import { getTimeLockControllerConfig } from "../missions/dao/timelock.config";
import { getDAOConfig } from "../missions/dao/zdao.config";


export const getDaoSystemConfig = async (
  admin : HardhatEthersSigner,
  instName : string,
) => {
  const baseConfig = await getBaseZModulesConfig({ deployAdmin: admin });

  return {
    ...baseConfig,
    votingERC20Config: getVoting20DeployConfig({ tokenAdmin: admin }),
    timeLockConfig: getTimeLockControllerConfig({
      timeLockAdmin: admin,
      votingTokenInstName: instName,
    }),
    daoConfig: getDAOConfig(),
  };
};
