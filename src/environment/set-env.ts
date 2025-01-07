/* eslint-disable @typescript-eslint/no-var-requires */
import { environment } from "./configs/env";


export const setDefaultEnvironment = () => {
  Object.entries(environment).forEach(([key, value]) => {
    // load the defaults first
    process.env[key] = value;
  });

  // override from local .env file if anything is present
  require("dotenv").config({ override: true });
};
