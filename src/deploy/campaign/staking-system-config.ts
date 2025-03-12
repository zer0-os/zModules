import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getStaking20DeployConfig } from "../missions/staking-erc20/staking20.config";
import { getVoting20DeployConfig } from "../missions/voting-erc20/voting20.config";
import { getBaseZModulesConfig } from "./base-campaign-config";
import { getVoting721DeployConfig } from "../missions/voting-erc721/voting721.config";
import { getStaking721DeployConfig } from "../missions/staking-erc721/staking721.config";


export const getStaking20SystemConfig = async (
  deployAdmin : HardhatEthersSigner,
  votingAdmin : HardhatEthersSigner,
  stakingAdmin : HardhatEthersSigner,
) => {
  const baseConfig = await getBaseZModulesConfig({ deployAdmin });

  return {
    ...baseConfig,
    votingERC20Config: getVoting20DeployConfig({ tokenAdmin: votingAdmin }),
    stakingERC20Config: getStaking20DeployConfig({ contractOwner: stakingAdmin }),
  };
};

export const getStaking721SystemConfig = async (
  deployAdmin : HardhatEthersSigner,
  votingAdmin : HardhatEthersSigner,
  stakingAdmin : HardhatEthersSigner,
) => {
  const baseConfig = await getBaseZModulesConfig({ deployAdmin });

  return {
    ...baseConfig,
    votingERC721Config: getVoting721DeployConfig({ tokenAdmin: votingAdmin }),
    stakingERC721Config: getStaking721DeployConfig({ contractOwner: stakingAdmin }),
  };
};
