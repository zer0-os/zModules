import { DCConfig } from "../types.campaign";

export const validateConfig = async (obj : DCConfig) =>  {

  const env = obj.env;
  const postDeploy = obj.postDeploy;

  if (env === undefined) {
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