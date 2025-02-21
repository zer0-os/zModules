import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import assert from "assert";
import { ITimelockConfig } from "../../campaign/types";


export const getTimeLockControllerConfig = ({
  timeLockAdmin,
  votingTokenInstName,
} : {
  timeLockAdmin : SignerWithAddress;
  votingTokenInstName : string;
}) : ITimelockConfig => {
  assert.ok(
    !!process.env.TIMELOCK_DELAY,
    "Missing required env variable TIMELOCK_DELAY for TimeLockController!"
  );

  const proposers = !!process.env.TIMELOCK_PROPOSERS
    ? process.env.TIMELOCK_PROPOSERS.split(",")
    : [];
  const executors = !!process.env.TIMELOCK_EXECUTORS
    ? process.env.TIMELOCK_EXECUTORS.split(",")
    : [];

  return {
    delay: BigInt(process.env.TIMELOCK_DELAY),
    proposers,
    executors,
    admin: timeLockAdmin,
    votingTokenInstName,
  };
};
