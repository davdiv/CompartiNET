import { expect } from "vitest";
import { applyAction, commandForAction, type NetworkAction } from "../../src/common/model/actions";
import { applyRuntimeMeta, recordActionMeta, type InterfaceRuntimeMetaMap } from "../../src/common/model/interfaceMeta";
import { collectState } from "../../src/node/collectState";
import { Config } from "../../src/node/features";
import { createReconciler } from "../../src/node/reconciler";
import { runCommand } from "../../src/node/spawnUtils";
import { checkReproducibleFromScratch, normalizeModel } from "../utils";

const runtimeMeta: InterfaceRuntimeMetaMap = {};

export const runActionAndVerify = async (action: NetworkAction) => {
  // Capture state immediately before the action under test
  const { state: beforeActual } = await collectState();
  applyRuntimeMeta(beforeActual, runtimeMeta);

  // Execute the action under test
  const command = commandForAction(action);
  await runCommand(command);

  // Record metadata before collecting after-state so it's available for enrichment
  recordActionMeta(runtimeMeta, action, beforeActual.namedNetns);

  // Capture state after
  const { state: afterActual } = await collectState();
  applyRuntimeMeta(afterActual, runtimeMeta);

  // Simulate the action on the before-state
  const expected = structuredClone(beforeActual);
  applyAction(expected, action);

  expect(normalizeModel(afterActual)).toEqual(normalizeModel(expected));
  await checkReproducibleFromScratch(beforeActual);
  await checkReproducibleFromScratch(afterActual);
  return { beforeActual, afterActual };
};

export const applyConfig = async (config: Config) => {
  const reconciler = createReconciler(() => config);
  const unsub = reconciler.watcher.addListener(() => {});
  await reconciler.applyReconciliation();
  unsub();
};

export const cleanupState = async () =>
  await applyConfig([
    {
      type: "SetInterfaceUp",
      netns: "",
      iface: "lo",
      up: true,
    },
  ]);
