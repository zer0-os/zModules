
// TODO esc: can we make this better ??
import { ethers } from "ethers";

export const matchDataStructTypeStr = "tuple(uint256,uint256,address[])";

// TODO esc: make this better and less manual along with the string above !!
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
