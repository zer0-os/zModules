import { baseConfig } from "./base.configenv";
import { staking20Config, staking721Config } from "./staking.configenv";
import { IZModulesEnvironment } from "../types";
import { voting20Config, voting721Config } from "./voting.configenv";
import { daoConfig, timelockConfig } from "./dao.configenv";
import { matchConfig } from "./match.configenv";
import { rewardsVaultConfig } from "./rewards-vault.configenv";


export const environment : IZModulesEnvironment = {
  ...baseConfig,
  ...voting20Config,
  ...voting721Config,
  ...staking20Config,
  ...staking721Config,
  ...daoConfig,
  ...timelockConfig,
  ...matchConfig,
  ...rewardsVaultConfig,
};
