import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { getContext, reactive } from "signalium";
import { parse as parseYaml } from "yaml";
import { MarkReloadable, type FeatureHandler } from "../../common/features/createFeatures";
import type { Feature } from "./index";
import { validate } from "./validator";

export interface ConfigFile {
  type: "ConfigFile";
  path: string;
}

export const configFileHandler: FeatureHandler<ConfigFile, Feature> = reactive(async ({ path }: ConfigFile) => {
  getContext(MarkReloadable)();
  const content = await readFile(path, "utf-8");
  const ext = extname(path);
  let parsed: unknown;
  if (ext === ".json") {
    parsed = JSON.parse(content);
  } else {
    parsed = parseYaml(content);
  }
  if (parsed == null) {
    return [];
  }
  const res = (Array.isArray(parsed) ? parsed : [parsed]) as Feature[];
  if (!validate(res)) {
    throw new Error(`Config error in ${path}: ${JSON.stringify(validate.errors)}`);
  }
  return res;
});
