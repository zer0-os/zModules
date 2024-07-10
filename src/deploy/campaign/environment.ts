import { IZModulesConfig } from "../types.campaign";


export const validateConfig = async (obj : IZModulesConfig) =>  {
  const {
    env,
    postDeploy,
  } = obj;

  if (!env) {
    throw new Error("Must provide ENV_LEVEL");
  } else if (
    env !== "dev" &&
    env !== "test" &&
    env !== "prod"
  ) {
    throw new Error("Provide correct ENV_LEVEL (dev / test / prod)");
  }

  for (const prop in postDeploy) {
    if (prop === undefined) {
      throw new Error("Must assign post deploy");
    }
  }

  return obj;
};