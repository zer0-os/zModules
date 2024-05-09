import { Match } from "../../../typechain";
import { TypedContractEvent, TypedEventLog } from "../../../typechain/common";


// TODO esc: extend to read any events
export const getMatchStartedEvents = async ({
  match,
  matchDataHash = undefined,
  matchId = undefined,
  players = undefined,
} : {
  match : Match;
  matchDataHash ?: string | undefined;
  matchId ?: bigint | undefined;
  players ?: Array<string> | undefined;
}) : Promise<Array<TypedEventLog<TypedContractEvent>>> => {
  const filter = match.filters.MatchStarted(
    matchDataHash,
    matchId,
    players,
    undefined,
    undefined,
  );

  return match.queryFilter(filter);
};
