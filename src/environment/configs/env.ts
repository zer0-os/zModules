import { baseConfig } from "./base.config";
import { staking20Config, staking721Config } from "./staking.config";


export const environment = {
  ...baseConfig,
  ...staking20Config,
  ...staking721Config,
};
