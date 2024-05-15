
import { ethers } from "ethers";

export const matchDataStructTypeStr = "tuple(uint256,uint256,address[])";

export const getMatchDataHash = ({
  matchId,
  matchFee,
  players,
} : {
  matchId : bigint;
  matchFee : bigint;
  players : Array<string>;
}) => {
  const matchDataEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    [matchDataStructTypeStr],
    [[matchId, matchFee, players]]
  );

  return ethers.keccak256(matchDataEncoded);
};
