import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validate } from "../../src/node/features/validator";
import { parse } from "yaml";

describe("sampleConfig.yaml", () => {
  it("should be valid", async () => {
    const file = parse(await readFile(join(import.meta.dirname, "../../sampleConfig.yaml"), "utf-8"));
    expect(validate(file)).toBe(true);
  });
});
