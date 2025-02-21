import { IDAOConfig } from "../../campaign/types";


export const getDAOConfig = () : IDAOConfig => {
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

  const config = {
    shouldRevokeAdminRole: process.env.DAO_REVOKE_ADMIN_ROLE !== "false",
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
