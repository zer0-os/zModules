import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getBaseZModulesConfig } from "./base-campaign-config";
import { getVoting20DeployConfig } from "../missions/voting-erc20/voting20.config";
import { getTimeLockControllerConfig } from "../missions/dao/timelock.config";
import { getDAOConfig } from "../missions/dao/zdao.config";
import { getVoting721DeployConfig } from "../missions/voting-erc721/voting721.config";


export const getDao20SystemConfig = async (
  deployAdmin : HardhatEthersSigner,
  timeLockAdmin : HardhatEthersSigner,
) => {
  const baseConfig = await getBaseZModulesConfig({ deployAdmin });

  return {
    ...baseConfig,
    votingERC20Config: getVoting20DeployConfig(),
    timeLockConfig: getTimeLockControllerConfig({ timeLockAdmin }),
    daoConfig: getDAOConfig(),
  };
};

export const getDao721SystemConfig = async (
  deployAdmin : HardhatEthersSigner,
  timeLockAdmin : HardhatEthersSigner,
  votingTokenAdmin : HardhatEthersSigner,
) => {
  const baseConfig = await getBaseZModulesConfig({ deployAdmin });

  return {
    ...baseConfig,
    votingERC721Config: getVoting721DeployConfig({ tokenAdmin: votingTokenAdmin }),
    timeLockConfig: getTimeLockControllerConfig({ timeLockAdmin }),
    daoConfig: getDAOConfig(),
  };
};
