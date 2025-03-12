import { exec } from "child_process";
import { getLogger, getMongoAdapter, TLogger } from "@zero-tech/zdc";
import { promisify } from "util";
import { getGitTag } from "../utils/git-tag/get-tag";


const execAsync = promisify(exec);

export const getZModulesLogger = ({
  logLevel = process.env.LOG_LEVEL || "debug",
  makeLogFile = process.env.MAKE_LOG_FILE === "true",
  silence = process.env.SILENT_LOGGER === "true",
} : {
  logLevel ?: string;
  makeLogFile ?: boolean;
  silence ?: boolean;
} = {}) => getLogger({
  logLevel,
  makeLogFile,
  silence,
});


export const getZModulesMongoAdapter = async ({
  contractsVersion,
  logger,
  dbUri = process.env.MONGO_DB_URI,
  dbName = process.env.MONGO_DB_NAME,
  dbVersion = process.env.MONGO_DB_VERSION,
  archiveDb = process.env.ARCHIVE_PREVIOUS_DB_VERSION === "true",
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
    contractsVersion = await getGitTag();
  }

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
  const logger = getZModulesLogger();

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
  const logger = getZModulesLogger();

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
