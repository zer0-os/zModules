import { IVotingERC20DeployArgs } from "../../campaign/types";


export const getVoting20DeployConfig = (
  config ?: IVotingERC20DeployArgs,
) => {
  if (!config) {
    if (
      !process.env.VOTING20_NAME ||
      !process.env.VOTING20_SYMBOL ||
      !process.env.VOTING20_ADMIN
    ) {
      throw new Error("Missing required env variables for VotingERC20!");
    }

    return {
      name: process.env.VOTING20_NAME,
      symbol: process.env.VOTING20_SYMBOL,
      admin: process.env.VOTING20_ADMIN,
    };
  } else {
    return config;
  }
};
