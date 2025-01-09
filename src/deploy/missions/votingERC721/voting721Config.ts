import { IVotingERC721DeployArgs } from "../../campaign/types";


export const getVoting721DeployConfig = (
  config ?: IVotingERC721DeployArgs,
) => {
  if (!config) {
    if (
      !process.env.VOTING721_NAME ||
      !process.env.VOTING721_SYMBOL ||
      !process.env.VOTING721_ADMIN
    ) {
      throw new Error("Missing required env variables for VotingERC721!");
    }

    return {
      name: process.env.VOTING721_NAME,
      symbol: process.env.VOTING721_SYMBOL,
      admin: process.env.VOTING721_ADMIN,
    };
  } else {
    return config;
  }
};

