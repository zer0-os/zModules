import assert from "assert";
import { IMatchDeployArgs } from "../../campaign/types";


export const getMatchDeployConfig = (
  env : string,
  mockTokens : boolean,
  config ?: IMatchDeployArgs
) : IMatchDeployArgs | undefined => {
  let configReturn;

  if (env === "dev" && process.env.MATCH_USE_DEV_ENV_VALUES !== "true") {
    configReturn = config;
  } else {
    if (
      !process.env.MATCH_FEE_VAULT_ADDRESS ||
      !process.env.MATCH_OPERATOR_ADDRESSES ||
      !process.env.MATCH_GAME_FEE_PERCENTAGE ||
      !process.env.MATCH_CONTRACT_OWNER_ADDRESS
    ) {
      throw new Error("Missing required env variables for Match!");
    }

    if (env === "prod" && !process.env.MATCH_PAYMENT_TOKEN) {
      throw new Error("Missing required env filled token for Match!");
    }

    const decoded = atob(process.env.MATCH_OPERATOR_ADDRESSES);
    let operators = [decoded];
    if (decoded.includes(",")) {
      operators = decoded.split(",");
    }

    configReturn = {
      token: process.env.MATCH_PAYMENT_TOKEN,
      feeVault: process.env.MATCH_FEE_VAULT_ADDRESS,
      owner: process.env.MATCH_CONTRACT_OWNER_ADDRESS, // have to be base64 encoded !
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
