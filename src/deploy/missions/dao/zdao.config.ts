import { IDAOConfig } from "../../campaign/types";
import assert from "assert";


export const getDAODeployConfig = (
  env : string,
  mockTokens : boolean
) : IDAOConfig => {
  if (
    !process.env.DAO_GOV_NAME ||
      !process.env.DAO_VOTING_TOKEN ||
      !process.env.DAO_TIMELOCK_CONTROLLER ||
      !process.env.DAO_VOTING_DELAY ||
      !process.env.DAO_VOTING_PERIOD ||
      !process.env.DAO_PROPOSAL_THRESHOLD ||
      !process.env.DAO_QUORUM_PERCENTAGE ||
      !process.env.DAO_VOTE_EXTENSION
  ) {
    throw new Error("Missing required env variables for DAO!");
  }

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

  return {
    governorName: process.env.DAO_GOV_NAME,
    token: process.env.DAO_VOTING_TOKEN,
    timelock: process.env.DAO_TIMELOCK_CONTROLLER,
    votingDelay: process.env.DAO_VOTING_DELAY,
    votingPeriod: process.env.DAO_VOTING_PERIOD,
    proposalThreshold: process.env.DAO_PROPOSAL_THRESHOLD,
    quorumPercentage: process.env.DAO_QUORUM_PERCENTAGE,
    voteExtension: process.env.DAO_VOTE_EXTENSION,
  };
};
