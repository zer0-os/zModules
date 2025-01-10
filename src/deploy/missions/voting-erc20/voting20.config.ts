import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IVotingERC20DeployArgs } from "../../campaign/types";


export const getVoting20DeployConfig = ({
  tokenAdmin,
} : {
  tokenAdmin : SignerWithAddress;
}) : IVotingERC20DeployArgs => {
  if (
    !process.env.VOTING20_NAME ||
    !process.env.VOTING20_SYMBOL
  ) {
    throw new Error("Missing required env variables for VotingERC20!");
  }

  return {
    name: process.env.VOTING20_NAME,
    symbol: process.env.VOTING20_SYMBOL,
    admin: tokenAdmin,
  };
};
