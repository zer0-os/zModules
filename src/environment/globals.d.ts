import { IZModulesEnvironment } from "./types";

declare global {
  namespace NodeJS {
    interface ProcessEnv extends IZModulesEnvironment {}
  }
}
