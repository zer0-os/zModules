import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { IVotingERC20DeployArgs } from "../../campaign/types";


export const getVoting20DeployConfig = ({
  tokenAdmin,
} : {
  tokenAdmin : SignerWithAddress;
}) : IVotingERC20DeployArgs => {
  if (
    !process.env.VOTING20_TOKEN_NAME ||
    !process.env.VOTING20_TOKEN_SYMBOL ||
    !process.env.VOTING20_DOMAIN_NAME ||
    !process.env.VOTING20_DOMAIN_VERSION
  ) {
    throw new Error("Missing required env variables for VotingERC20!");
  }

  // TODO dep: add other vars here and in the mission when updated with post audit code
  return {
    name: process.env.VOTING20_TOKEN_NAME,
    symbol: process.env.VOTING20_TOKEN_SYMBOL,
    admin: tokenAdmin,
  };
};
