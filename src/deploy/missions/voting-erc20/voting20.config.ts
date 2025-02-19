import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IVotingERC20Config } from "../../campaign/types";


export const getVoting20DeployConfig = ({
  tokenAdmin,
} : {
  tokenAdmin : SignerWithAddress;
}) : IVotingERC20Config => {
  if (!tokenAdmin) throw new Error("Missing token admin for VotingERC20!");

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
    admin: tokenAdmin,
  };
};
