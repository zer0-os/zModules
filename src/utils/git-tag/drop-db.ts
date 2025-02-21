import { getZModulesMongoAdapter, startMongo, stopMongo } from "../../deploy/mongo";


export const dropDB = async () => {
  try {
    const adapter = await getZModulesMongoAdapter();
    await adapter.dropDB();
    await stopMongo();
  } catch (e) {
    await startMongo();
    await dropDB();
  }
};