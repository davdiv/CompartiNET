import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { getContext, reactive } from "signalium";
import { MarkReloadable, type FeatureHandler } from "../../common/features/createFeatures";
import type { Feature } from "./index";

export interface ConfigDirectory {
  type: "ConfigDirectory";
  path: string;
}

const SUPPORTED_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);

export const configDirectoryHandler: FeatureHandler<ConfigDirectory, Feature> = reactive(async ({ path }: ConfigDirectory) => {
  getContext(MarkReloadable)();
  return (await readdir(path))
    .filter((entry) => SUPPORTED_EXTENSIONS.has(extname(entry)))
    .sort()
    .map((entry) => ({ type: "ConfigFile", path: join(path, entry) }));
});
