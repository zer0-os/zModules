import assert from "assert";
import { IDAOConfig } from "../../campaign/types";


export const getDAOConfig = () : IDAOConfig => {
  const env = process.env.ENV_LEVEL;
  let config = {} as IDAOConfig;

  const mockTokens =
      (env === "dev" || env === "test") &&
      (!process.env.DAO_VOTING_TOKEN || !process.env.DAO_TIMELOCK_CONTROLLER);

  if (
    !process.env.DAO_GOV_NAME ||
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
        !!process.env.DAO_VOTING_TOKEN && !!process.env.DAO_TIMELOCK_CONTROLLER,
        "Must provide Voting token and Timelock controller addresses for DAO when not mocking!"
      );
    }
  } else {
    assert.ok(!mockTokens, "Cannot MOCK_TOKENS in prod environment!");
  }

  config = {
    mockTokens,
    governorName: process.env.DAO_GOV_NAME,
    votingToken: process.env.DAO_VOTING_TOKEN,
    timelockController: process.env.DAO_TIMELOCK_CONTROLLER,
    votingDelay: BigInt(process.env.DAO_VOTING_DELAY),
    votingPeriod: BigInt(process.env.DAO_VOTING_PERIOD),
    proposalThreshold: BigInt(process.env.DAO_PROPOSAL_THRESHOLD),
    quorumPercentage: BigInt(process.env.DAO_QUORUM_PERCENTAGE),
    voteExtension: BigInt(process.env.DAO_VOTE_EXTENSION),
  };

  return config;
};
