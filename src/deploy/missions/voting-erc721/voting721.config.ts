import { IVotingERC721DeployArgs } from "../../campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export const getVoting721DeployConfig = ({
  tokenAdmin,
} : {
  tokenAdmin : SignerWithAddress;
}) : IVotingERC721DeployArgs => {
  if (
    !process.env.VOTING721_NAME ||
      !process.env.VOTING721_SYMBOL ||
      !process.env.VOTING721_VERSION ||
      !process.env.VOTING721_URI
  ) {
    throw new Error("Missing required env variables for VotingERC721!");
  }

  return {
    name: process.env.VOTING721_NAME,
    symbol: process.env.VOTING721_SYMBOL,
    version: process.env.VOTING721_VERSION,
    baseUri: process.env.VOTING721_URI,
    admin: tokenAdmin,
  };
};

