import { expect } from "vitest";
import { createDesiredModelFromBasicFeatures } from "../src/common/features";
import { NetworkModel } from "../src/common/model/networkModel";
import { validate as isModelValid } from "../src/common/model/validator";
import { modelToConfig } from "../src/common/reconcile/modelToConfig";
import { validate as isConfigValid } from "../src/node/features/validator";
import { processFeatures } from "../src/node/features";
import { checkModelConsistency } from "../src/common/model/consistency";

/**
 * Normalizes a network model for comparison by stripping fields that the current
 * state collector cannot reliably reproduce after applying an action.
 *
 * Known gaps:
 * - `macAddress`: `applyAction` never sets it, but `collectState` reads it.
 */
export const normalizeModel = (model: NetworkModel): NetworkModel => {
  validateModel(model);

  // Build a deterministic inode remapping: sort names, "" always first, assign 0,1,2...
  const names = Object.keys(model.namedNetns).sort((a, b) => {
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b);
  });
  const inodeMap = new Map<number, number>();
  names.forEach((name, i) => {
    inodeMap.set(model.namedNetns[name], i);
  });

  const remapInode = (inode: number) => inodeMap.get(inode) ?? inode;

  const result: NetworkModel = { namedNetns: {}, netnsByIno: {} };
  for (const name of names) {
    const oldInode = model.namedNetns[name];
    const newInode = inodeMap.get(oldInode)!;
    result.namedNetns[name] = newInode;
    const ns = model.netnsByIno[oldInode];
    const interfaces: typeof ns.interfaces = {};
    for (const [ifaceName, iface] of Object.entries(ns.interfaces)) {
      const rest = { ...iface };
      if (rest.type !== "altname") {
        delete rest.macAddress;
        rest.addresses = rest.addresses
          .filter((addr) => {
            if (addr.family === "ipv6" && addr.address.startsWith("fe80:")) return false;
            return true;
          })
          .sort((a, b) => {
            if (a.family !== b.family) return a.family.localeCompare(b.family);
            if (a.address !== b.address) return a.address.localeCompare(b.address);
            return a.prefixLength - b.prefixLength;
          });
        if ("peerNetns" in rest) {
          rest.peerNetns = remapInode(rest.peerNetns);
        }
        if ("birthNetns" in rest && rest.birthNetns !== undefined) {
          rest.birthNetns = remapInode(rest.birthNetns);
        }
      }
      interfaces[ifaceName] = rest;
    }
    result.netnsByIno[newInode] = {
      names: [name],
      interfaces,
      routes: ns.routes,
      listeningSockets: ns.listeningSockets,
    };
  }
  return result;
};

export const checkReproducibleFromScratch = async (model: NetworkModel) => {
  const config = modelToConfig(model);
  await validateConfig(config);
  const newModel = createDesiredModelFromBasicFeatures(config);
  expect(normalizeModel(model)).toEqual(normalizeModel(newModel));
};

const stringifyValidationErrors = (errors: any) => {
  if (!errors || !Array.isArray(errors)) return "";
  return errors
    .map((err: any) => {
      const path = err.instancePath || "/";
      const message = err.message || "unknown error";
      return `  ${path}: ${message}`;
    })
    .join("\n");
};

export const validateConfig = async (config: any) => {
  if (!isConfigValid(config)) {
    expect.fail(`Invalid config: ${JSON.stringify(config, null, 2)}\nValidation errors: ${stringifyValidationErrors(isConfigValid.errors)}`);
  }
  const { desiredState } = await processFeatures(config, {
    getServiceOutput() {
      return null;
    },
  });
  validateModel(desiredState);
};

export const validateModel = (model: any) => {
  if (!isModelValid(model)) {
    expect.fail(`Invalid model: ${JSON.stringify(model, null, 2)}\nValidation errors: ${stringifyValidationErrors(isModelValid.errors)}`);
  }
  checkModelConsistency(model);
};
