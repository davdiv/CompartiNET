import { expect } from "vitest";
import { applyAction, commandForActions, type NetworkAction } from "../../src/common/model/actions";
import { collectState } from "../../src/node/collectState";
import { exec, runCommands } from "../../src/node/spawnUtils";
import { checkReproducibleFromScratch, normalizeModel } from "../utils";
import { applyRuntimeMeta, recordActionMeta, type InterfaceRuntimeMetaMap } from "../../src/common/model/interfaceMeta";

const createdNetns = new Set<string>();

export const trackNetns = (netns: string) => {
  if (netns) {
    createdNetns.add(netns);
  }
};

export const cleanupState = async () => {
  for (const netns of createdNetns) {
    try {
      await exec(["ip", "netns", "del", netns]);
    } catch {
      // ignore cleanup errors
    }
  }
  createdNetns.clear();
};

export { runCommands };

const runtimeMeta: InterfaceRuntimeMetaMap = {};

export const runActionAndVerify = async (action: NetworkAction) => {
  // Capture state immediately before the action under test
  const beforeActual = await collectState();
  applyRuntimeMeta(beforeActual, runtimeMeta);

  // Execute the action under test
  const commands = commandForActions([action]);
  await runCommands(commands);

  // Track created namespaces so cleanup works even if the assertion fails
  if (action.type === "CreateNamespace") {
    trackNetns(action.netns);
  }

  // Record metadata before collecting after-state so it's available for enrichment
  recordActionMeta(runtimeMeta, action, beforeActual.namedNetns);

  // Capture state after
  const afterActual = await collectState();
  applyRuntimeMeta(afterActual, runtimeMeta);

  // Simulate the action on the before-state
  const expected = structuredClone(beforeActual);
  applyAction(expected, action);

  expect(normalizeModel(afterActual)).toEqual(normalizeModel(expected));
  checkReproducibleFromScratch(beforeActual);
  checkReproducibleFromScratch(afterActual);
};
