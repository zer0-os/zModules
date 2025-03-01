import assert from "assert";
import { IMatchConfig } from "../../campaign/types";


export const getMatchDeployConfig = ({
  mockTokens,
  config,
} : {
  mockTokens : boolean;
  config ?: IMatchConfig;
}) : IMatchConfig => {

  let configReturn;
  const env = process.env.ENV_LEVEL;

  if (config) {
    configReturn = config;
  } else {
    if (
      !process.env.MATCH_FEE_VAULT  ||
      !process.env.MATCH_OPERATORS ||
      !process.env.MATCH_GAME_FEE_PERCENTAGE ||
      !process.env.MATCH_CONTRACT_OWNER
    ) {
      throw new Error("Missing required env variables for Match!");
    }

    if (env === "prod" && !process.env.MATCH_TOKEN) {
      throw new Error("Missing required env filled token for Match!");
    }

    const operators = JSON.parse(process.env.MATCH_OPERATORS);

    configReturn = {
      token: process.env.MATCH_TOKEN,
      feeVault: process.env.MATCH_FEE_VAULT,
      owner: process.env.MATCH_CONTRACT_OWNER, // have to be base64 encoded !
      operators,
      gameFeePercentage: BigInt(process.env.MATCH_GAME_FEE_PERCENTAGE),
    };
  }

  if (env === "dev" || env === "test") {
    if (!mockTokens) {
      assert.ok(
        !!configReturn?.token,
        "Must provide token address for Match when not mocking!"
      );
    }
  } else {
    assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
  }

  return configReturn;
};
