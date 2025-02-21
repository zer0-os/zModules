import { MATCH_GAME_FEE_PERCENTAGE_DEFAULT } from "../../../test/helpers/constants";

/**
 * Default environment for Match
 */
export const matchConfig = {
  MATCH_TOKEN: "",
  FEE_VAULT: "",
  MATCH_OWNER: "",
  MATCH_OPERATORS: "[]",
  MATCH_GAME_FEE_PERCENTAGE: MATCH_GAME_FEE_PERCENTAGE_DEFAULT.toString(),
};