import { IVotingERC721Config } from "../../campaign/types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


export const getVoting721DeployConfig = ({
  tokenAdmin,
} : {
  tokenAdmin : SignerWithAddress;
}) : IVotingERC721Config => {
  if (!tokenAdmin) throw new Error("Missing token admin for VotingERC721!");

  if (
    !process.env.VOTING721_TOKEN_NAME ||
      !process.env.VOTING721_TOKEN_SYMBOL ||
      !process.env.VOTING721_DOMAIN_NAME ||
      !process.env.VOTING721_DOMAIN_VERSION ||
      !process.env.VOTING721_BASE_URI
  ) {
    throw new Error("Missing required env variables for VotingERC721!");
  }

  return {
    name: process.env.VOTING721_TOKEN_NAME,
    symbol: process.env.VOTING721_TOKEN_SYMBOL,
    baseUri: process.env.VOTING721_BASE_URI,
    domainName: process.env.VOTING721_DOMAIN_NAME,
    domainVersion: process.env.VOTING721_DOMAIN_VERSION,
    admin: tokenAdmin,
  };
};
