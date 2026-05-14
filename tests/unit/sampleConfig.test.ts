import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { validateConfig } from "../utils";

describe("sampleConfig.yaml", () => {
  it("should be valid", async () => {
    const file = parse(await readFile(join(import.meta.dirname, "../../sampleConfig.yaml"), "utf-8"));
    await validateConfig(file);
  });
});

describe("README.md", () => {
  it("should have a valid example", async () => {
    const file = await readFile(join(import.meta.dirname, "../../README.md"), "utf-8");
    const yamlBegin = file.indexOf("```yaml\n");
    expect(yamlBegin).toBeGreaterThan(-1);
    const yamlEnd = file.indexOf("```\n", yamlBegin + 1);
    expect(yamlBegin).toBeGreaterThan(-1);
    const parsedYaml = parse(file.slice(yamlBegin + 8, yamlEnd));
    await validateConfig(parsedYaml);
  });
});
