
const required = [
  "CONFIRMATION_N",
  "MONGO_DB_URI",
  "MONGO_DB_NAME",
  "ARCHIVE_PREVIOUS_DB_VERSION",
  "LOG_LEVEL",
];

export const findMissingEnvVars = () => {
  const missing = required.filter(
    key =>
      process.env[key] === undefined || process.env[key] === ""
  );

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};
