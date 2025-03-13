import { EnvironmentLevels } from "@zero-tech/zdc";
import { getZModulesMongoAdapter } from "../src/deploy/mongo";


export const mochaGlobalSetup = async () => {
  await getZModulesMongoAdapter();
};

export const mochaGlobalTeardown = async () => {
  const mongoAdapter = await getZModulesMongoAdapter();
  // the next line can be commented out to leave the DB after test to manually test
  if (process.env.ENV_LEVEL === EnvironmentLevels.dev) await mongoAdapter.dropDB();
  await mongoAdapter.close();
};
