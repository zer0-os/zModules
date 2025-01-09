import { IDAODeployArgs } from "../../campaign/types";
import assert from "assert";


export const getDAODeployConfig = (
  env : string,
  mockTokens : boolean,
  config ?: IDAODeployArgs
) => {
  if (!config) {
    if (
      !process.env.GOV_NAME ||
      !process.env.DAO_VOTING_TOKEN ||
      !process.env.TIMELOCK_CONTROLLER ||
      !process.env.VOTING_DELAY ||
      !process.env.VOTING_PERIOD ||
      !process.env.PROPOSAL_THRESHOLD ||
      !process.env.QUORUM_PERCENTAGE ||
      !process.env.VOTE_EXTENSION
    ) {
      throw new Error("Missing required env variables for DAO!");
    }

    return {
      governorName: process.env.GOV_NAME,
      token: process.env.DAO_VOTING_TOKEN,
      timelock: process.env.TIMELOCK_CONTROLLER,
      votingDelay: process.env.VOTING_DELAY,
      votingPeriod: process.env.VOTING_PERIOD,
      proposalThreshold: process.env.PROPOSAL_THRESHOLD,
      quorumPercentage: process.env.QUORUM_PERCENTAGE,
      voteExtension: process.env.VOTE_EXTENSION,
    };
  } else {
    if (env === "dev" || env === "test") {
      if (!mockTokens) {
        assert.ok(
          !!config?.token,
          "Must provide token address for DAO when not mocking!"
        );
      }
    } else {
      assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
    }

    return config;
  }
};
