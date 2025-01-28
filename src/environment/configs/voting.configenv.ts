import { IVoting20Environment, IVoting721Environment } from "../types";


export const voting20Config : IVoting20Environment = {
  VOTING20_TOKEN_NAME: "ZeroVotingERC20",
  VOTING20_TOKEN_SYMBOL: "ZVT",
  VOTING20_DOMAIN_NAME: "voting20",
  VOTING20_DOMAIN_VERSION: "1.0",
};

export const voting721Config : IVoting721Environment = {
  VOTING721_TOKEN_NAME: "ZeroVotingERC721",
  VOTING721_TOKEN_SYMBOL: "ZVNFT",
  VOTING721_BASE_URI: "https://voting721.com/",
  VOTING721_DOMAIN_NAME: "voting721",
  VOTING721_DOMAIN_VERSION: "1.0",
};
