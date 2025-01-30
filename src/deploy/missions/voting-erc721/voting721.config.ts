import { IVotingERC721Config } from "../../campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export const getVoting721DeployConfig = ({
  tokenAdmin,
} : {
  tokenAdmin : SignerWithAddress;
}) : IVotingERC721Config => {
  if (
    !process.env.VOTING721_TOKEN_NAME ||
      !process.env.VOTING721_TOKEN_SYMBOL ||
      !process.env.VOTING721_DOMAIN_NAME ||
      !process.env.VOTING721_DOMAIN_VERSION ||
      !process.env.VOTING721_BASE_URI
  ) {
    throw new Error("Missing required env variables for VotingERC721!");
  }

  // TODO dep: add other vars here and in the mission when updated with post audit code
  return {
    name: process.env.VOTING721_TOKEN_NAME,
    symbol: process.env.VOTING721_TOKEN_SYMBOL,
    version: process.env.VOTING721_DOMAIN_VERSION,
    baseUri: process.env.VOTING721_BASE_URI,
    admin: tokenAdmin,
  };
};

