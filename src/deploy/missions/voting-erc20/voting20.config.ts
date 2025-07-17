import { IVotingERC20Config } from "../../campaign/types";


export const getVoting20DeployConfig = () : IVotingERC20Config => {
  if (
    !process.env.VOTING20_TOKEN_NAME ||
    !process.env.VOTING20_TOKEN_SYMBOL ||
    !process.env.VOTING20_DOMAIN_NAME ||
    !process.env.VOTING20_DOMAIN_VERSION
  ) {
    throw new Error("Missing required env variables for VotingERC20!");
  }

  return {
    name: process.env.VOTING20_TOKEN_NAME,
    symbol: process.env.VOTING20_TOKEN_SYMBOL,
    domainName: process.env.VOTING20_DOMAIN_NAME,
    domainVersion: process.env.VOTING20_DOMAIN_VERSION,
  };
};
