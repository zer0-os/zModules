import { exec } from "child_process";
import { getLogger, getMongoAdapter, TLogger } from "@zero-tech/zdc";
import { promisify } from "util";
import { getGitTag } from "../utils/git-tag/get-tag";


const execAsync = promisify(exec);


// TODO dep: update function to pass all env variables from local repo as parameters
//  to the zDC function!
export const getZModulesMongoAdapter = async ({
  contractsVersion,
  logger,
  dbUri,
  dbName,
  dbVersion,
  archiveDb,
  clientOpts,
} : {
  contractsVersion ?: string;
  logger ?: TLogger;
  dbUri ?: string;
  dbName ?: string;
  dbVersion ?: string;
  archiveDb ?: boolean;
  clientOpts ?: Record<string, unknown>;
} = {}) => {
  if (!contractsVersion) {
    contractsVersion = getGitTag();
  }
  if (!dbUri) {
    dbUri = process.env.DB_URI;
  }
  if (!dbName) {
    dbName = process.env.DB_NAME;
  }
  if (!dbVersion) {
    dbVersion = process.env.DB_VERSION;
  }
  if (!archiveDb) {
    archiveDb = process.env.ARCHIVE_DB;
  }

  // TODO dep: pass here !!!
  return getMongoAdapter({
    logger,
    contractsVersion,
    dbUri,
    dbName,
    dbVersion,
    archiveDb,
    clientOpts,
  });
};

export const startMongo = async () => {
  const logger = getLogger({
    logLevel: process.env.LOG_LEVEL,
    makeLogFile: process.env.MAKE_LOG_FILE === "false",
    silence: process.env.SILENT_LOGGER === "true",
  });

  try {
    exec("npm run mongo:start");
    logger.info("MongoDB started");
  } catch (e) {
    logger.error({
      message: "Failed to start MongoDB Docker",
      error: e,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    throw new Error(e.message);
  }
};

export const stopMongo = async () => {
  const logger = getLogger({
    silence: process.env.SILENT_LOGGER === "true",
  });

  try {
    await execAsync("npm run mongo:stop");
    logger.info("MongoDB stopped");
  } catch (e) {
    logger.error({
      message: "Failed to stop MongoDB Docker",
      error: e,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    throw new Error(e.message);
  }
};
