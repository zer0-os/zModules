import { Match } from "../../../typechain";
import { TypedContractEvent, TypedEventLog } from "../../../typechain/common";


export const getMatchEvents = async ({
  match,
  eventName = "MatchStarted",
  matchDataHash = undefined,
  matchId = undefined,
  players = undefined,
} : {
  match : Match;
  matchDataHash ?: string | undefined;
  eventName ?: "MatchStarted" | "MatchEnded" | undefined;
  matchId ?: bigint | undefined;
  players ?: Array<string> | undefined;
}) : Promise<Array<TypedEventLog<TypedContractEvent>>> => {
  let filter;
  if (eventName === "MatchEnded") {
    filter = match.filters.MatchEnded(
      matchDataHash,
      matchId,
      players,
      undefined,
      undefined,
      undefined
    );
  } else {
    filter = match.filters.MatchStarted(
      matchDataHash,
      matchId,
      players,
      undefined,
      undefined
    );
  }

  return match.queryFilter(filter);
};
