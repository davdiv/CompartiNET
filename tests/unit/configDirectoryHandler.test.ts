import { beforeEach, describe, expect, it, vi } from "vitest";
import { signal } from "signalium";

const mockedFiles: Record<string, string> = {};

const enoent = (syscall: string, path: string) => {
  const err = new Error(`ENOENT: no such file or directory, ${syscall} '${path}'`) as NodeJS.ErrnoException;
  err.errno = -2;
  err.code = "ENOENT";
  err.syscall = syscall;
  err.path = path;
  return err;
};

vi.mock("node:fs", () => ({
  readFileSync: (path: string) => {
    if (Object.hasOwn(mockedFiles, path)) {
      return mockedFiles[path];
    }
    throw enoent("open", path);
  },
  readdirSync: (dirPath: string) => {
    const entries = Object.keys(mockedFiles)
      .filter((f) => f.startsWith(dirPath + "/"))
      .map((f) => f.slice(dirPath.length + 1))
      .filter((e) => !e.includes("/"));
    if (entries.length === 0) {
      throw enoent("scandir", dirPath);
    }
    return entries;
  },
}));

vi.mock("node:fs/promises", () => ({
  readFile: (path: string) => {
    if (Object.hasOwn(mockedFiles, path)) {
      return Promise.resolve(mockedFiles[path]);
    }
    return Promise.reject(enoent("open", path));
  },
  readdir: (dirPath: string) => {
    const entries = Object.keys(mockedFiles)
      .filter((f) => f.startsWith(dirPath + "/"))
      .map((f) => f.slice(dirPath.length + 1))
      .filter((e) => !e.includes("/"));
    if (entries.length === 0) {
      return Promise.reject(enoent("scandir", dirPath));
    }
    return Promise.resolve(entries);
  },
}));

import { processFeatures, type Feature } from "../../src/node/features";

describe("ConfigDirectoryHandler", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockedFiles)) {
      delete mockedFiles[key];
    }
  });

  it("returns a rejection when directory is missing (ENOENT)", async () => {
    await expect(processFeatures([{ type: "ConfigDirectory", path: "/nonexistent" }], null!)).rejects.toThrow(/ENOENT/);
  });

  it("loads a single JSON file with one action", async () => {
    const dir = "/etc/compartinet-test-1";
    mockedFiles[`${dir}/test.json`] = JSON.stringify({ type: "CreateNamespace", netns: "test-ns" });

    const { desiredState: model } = await processFeatures([{ type: "ConfigDirectory", path: dir }], null!);
    expect(Object.keys(model.namedNetns)).toContain("test-ns");
  });

  it("loads a JSON file with an array of actions", async () => {
    const dir = "/etc/compartinet-test-2";
    mockedFiles[`${dir}/actions.json`] = JSON.stringify([
      { type: "CreateNamespace", netns: "ns1" },
      { type: "CreateNamespace", netns: "ns2" },
    ]);

    const { desiredState: model } = await processFeatures([{ type: "ConfigDirectory", path: dir }], null!);
    expect(Object.keys(model.namedNetns)).toContain("ns1");
    expect(Object.keys(model.namedNetns)).toContain("ns2");
  });

  it("loads a YAML file with a single action", async () => {
    const dir = "/etc/compartinet-test-3";
    mockedFiles[`${dir}/test.yaml`] = "type: CreateNamespace\nnetns: yaml-ns\n";

    const { desiredState: model } = await processFeatures([{ type: "ConfigDirectory", path: dir }], null!);
    expect(Object.keys(model.namedNetns)).toContain("yaml-ns");
  });

  it("loads a YAML file with .yml extension equally", async () => {
    const dir = "/etc/compartinet-test-4";
    mockedFiles[`${dir}/test.yml`] = "type: CreateNamespace\nnetns: yml-ns\n";

    const { desiredState: model } = await processFeatures([{ type: "ConfigDirectory", path: dir }], null!);
    expect(Object.keys(model.namedNetns)).toContain("yml-ns");
  });

  it("skips null or empty YAML files", async () => {
    const dir = "/etc/compartinet-test-5";
    mockedFiles[`${dir}/empty.yaml`] = "";

    const { desiredState: model } = await processFeatures([{ type: "ConfigDirectory", path: dir }], null!);
    expect(model.namedNetns).toEqual({ "": 0 });
    expect(model.netnsByIno).toEqual({ 0: { names: [""], interfaces: { lo: expect.anything() }, routes: [], listeningSockets: [] } });
  });

  it("ignores files with unsupported extensions", async () => {
    const dir = "/etc/compartinet-test-6";
    mockedFiles[`${dir}/notes.txt`] = "not config";
    mockedFiles[`${dir}/setup.conf`] = "not either";

    const { desiredState: model } = await processFeatures([{ type: "ConfigDirectory", path: dir }], null!);
    expect(model.namedNetns).toEqual({ "": 0 });
    expect(model.netnsByIno).toEqual({ 0: { names: [""], interfaces: { lo: expect.anything() }, routes: [], listeningSockets: [] } });
  });

  it("processes files in alphabetical order", async () => {
    const dir = "/etc/compartinet-test-7";
    mockedFiles[`${dir}/20-second.json`] = JSON.stringify({ type: "CreateNamespace", netns: "second" });
    mockedFiles[`${dir}/10-first.json`] = JSON.stringify({ type: "CreateNamespace", netns: "first" });

    const { desiredState: model } = await processFeatures([{ type: "ConfigDirectory", path: dir }], null!);
    const nsOrder = Object.keys(model.namedNetns);
    const firstIdx = nsOrder.indexOf("first");
    const secondIdx = nsOrder.indexOf("second");
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it("throws on invalid JSON with file path context", async () => {
    const dir = "/etc/compartinet-test-8";
    mockedFiles[`${dir}/bad.json`] = "{not valid json";

    await expect(processFeatures([{ type: "ConfigDirectory", path: dir }], null!)).rejects.toThrow(SyntaxError);
  });

  it("throws on invalid YAML with file path context", async () => {
    const dir = "/etc/compartinet-test-9";
    mockedFiles[`${dir}/bad.yaml`] = "type: [unclosed";

    await expect(processFeatures([{ type: "ConfigDirectory", path: dir }], null!)).rejects.toThrow();
  });

  it("reactively updates when the config path changes", async () => {
    const dir1 = "/etc/compartinet-test-10a";
    const dir2 = "/etc/compartinet-test-10b";
    mockedFiles[`${dir1}/config.json`] = JSON.stringify({ type: "CreateNamespace", netns: "first-ns" });
    mockedFiles[`${dir2}/config.json`] = JSON.stringify({ type: "CreateNamespace", netns: "second-ns" });

    const features$ = signal<Feature[]>([{ type: "ConfigDirectory", path: dir1 }]);
    const { desiredState: model } = await processFeatures(features$.value, null!);
    expect(Object.keys(model.namedNetns)).toContain("first-ns");

    features$.update(() => [{ type: "ConfigDirectory", path: dir2 }]);
    const { desiredState: model2 } = await processFeatures(features$.value, null!);
    expect(Object.keys(model2.namedNetns)).toContain("second-ns");
  });

  it("supports nested ConfigDirectory features", async () => {
    const dir = "/etc/compartinet-test-11";
    const nestedDir = "/etc/compartinet-test-11-nested";
    mockedFiles[`${dir}/main.json`] = JSON.stringify({
      type: "ConfigDirectory",
      path: nestedDir,
    });
    mockedFiles[`${nestedDir}/sub.json`] = JSON.stringify({ type: "CreateNamespace", netns: "nested-ns" });

    const { desiredState: model } = await processFeatures([{ type: "ConfigDirectory", path: dir }], null!);
    expect(Object.keys(model.namedNetns)).toContain("nested-ns");
  });
});
