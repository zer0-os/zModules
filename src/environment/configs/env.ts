import { baseConfig } from "./base.config";
import { staking20Config, staking721Config } from "./staking.config";
import { IZModulesEnvironment } from "../types";
import { voting20Config, voting721Config } from "./voting.config";


export const environment : IZModulesEnvironment = {
  ...baseConfig,
  ...voting20Config,
  ...voting721Config,
  ...staking20Config,
  ...staking721Config,
};
