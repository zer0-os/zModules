import { IDAOEnvironment, ITimeLockEnvironment } from "../types";


/**
 * Default environment for ZDAO
 */
export const daoConfig : IDAOEnvironment = {
  DAO_REVOKE_ADMIN_ROLE: "true",
  DAO_GOV_NAME: "ZDAO",
  DAO_VOTING_TOKEN: "",
  DAO_TIMELOCK_CONTROLLER: "",
  DAO_VOTING_DELAY: "2",
  DAO_VOTING_PERIOD: "10",
  DAO_PROPOSAL_THRESHOLD: "15",
  DAO_QUORUM_PERCENTAGE: "10",
  DAO_VOTE_EXTENSION: "5",
};

/**
 * Default environment for TimeLockController
 */
export const timelockConfig : ITimeLockEnvironment = {
  TIMELOCK_DELAY: "30",
  TIMELOCK_PROPOSERS: "",
  TIMELOCK_EXECUTORS: "",
  TIMELOCK_ADMIN: "",
  // TODO dep: figure out how to determine token type and subsequently the instanceName of
  //  the VotingToken contract to get from inside the mission to be able to call it
  TIMELOCK_VOTING_TOKEN_TYPE: "",
};
