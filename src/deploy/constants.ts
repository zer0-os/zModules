import { ethers } from "ethers";

export const roles = {
  timelock: {
    DEFAULT_ADMIN_ROLE: ethers.solidityPackedKeccak256(
      ["string"],
      ["DEFAULT_ADMIN_ROLE"]
    ),
    PROPOSER_ROLE: ethers.solidityPackedKeccak256(
      ["string"],
      ["PROPOSER_ROLE"]
    ),
    EXECUTOR_ROLE: ethers.solidityPackedKeccak256(
      ["string"],
      ["EXECUTOR_ROLE"]
    ),
  },
  voting: {
    DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
    MINTER_ROLE: ethers.solidityPackedKeccak256(
      ["string"],
      ["MINTER_ROLE"]
    ),
    BURNER_ROLE: ethers.solidityPackedKeccak256(
      ["string"],
      ["BURNER_ROLE"]
    ),
  },
};