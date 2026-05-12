import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone";
import { writeFile } from "fs/promises";
import { resolve } from "path";
import tjs from "typescript-json-schema";
import { fileURLToPath } from "url";
import { Plugin } from "vite";

const networkModelFile = fileURLToPath(new URL("./src/common/model/networkModel.ts", import.meta.url));
const modelValidatorFile = fileURLToPath(new URL("./src/common/model/validator.js", import.meta.url));
const configFile = fileURLToPath(new URL("./src/node/features/index.ts", import.meta.url));
const configValidatorFile = fileURLToPath(new URL("./src/node/features/validator.js", import.meta.url));
const tsconfigFile = fileURLToPath(new URL("./tsconfig.node.json", import.meta.url));

interface SchemaEntry {
  file: string;
  typeName: string;
  validatorFile: string;
  schema?: object;
}

const entries: SchemaEntry[] = [
  { file: networkModelFile, typeName: "NetworkModel", validatorFile: modelValidatorFile },
  { file: configFile, typeName: "Config", validatorFile: configValidatorFile },
];

const validatorSet = new Set(entries.map((e) => e.validatorFile));

function generateSchema(file: string, typeName: string): object {
  const program = tjs.programFromConfig(tsconfigFile, [file]);
  return tjs.generateSchema(program, typeName, { noExtraProps: true, required: true })!;
}

function generateValidatorModule(schema: object): string {
  const ajv = new Ajv({ code: { source: true, esm: true }, allowUnionTypes: true });
  const validate = ajv.compile(schema);
  return standaloneCode(ajv, validate);
}

export const schemaPlugin = (): Plugin => ({
  name: "schema",
  enforce: "pre",
  resolveId(id, source) {
    if (source && validatorSet.has(resolve(source, "..", id) + ".js")) {
      return { id: resolve(source, "..", id) + ".js", external: false };
    }
  },
  async load(id) {
    const entry = entries.find((e) => e.validatorFile === id);
    if (entry) {
      entry.schema ??= generateSchema(entry.file, entry.typeName);
      return generateValidatorModule(entry.schema);
    }
  },
  async closeBundle() {
    for (const entry of entries) {
      entry.schema ??= generateSchema(entry.file, entry.typeName);
      await writeFile(new URL(`./dist/${entry.typeName === "NetworkModel" ? "model" : "config"}-schema.json`, import.meta.url), JSON.stringify(entry.schema));
    }
  },
});
