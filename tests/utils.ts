import { expect } from "vitest";
import { createDesiredModelFromBasicFeatures } from "../src/common/features";
import { NetworkModel } from "../src/common/model/networkModel";
import { validate } from "../src/common/model/validator";
import { modelToConfig } from "../src/common/reconcile/modelToConfig";
import { validate as validateConfig } from "../src/node/features/validator";

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

  const result: NetworkModel = { namedNetns: {}, netnsById: {} };
  for (const name of names) {
    const oldInode = model.namedNetns[name];
    const newInode = inodeMap.get(oldInode)!;
    result.namedNetns[name] = newInode;
    const ns = model.netnsById[oldInode];
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
    result.netnsById[newInode] = {
      interfaces,
      routes: ns.routes,
      listeningSockets: ns.listeningSockets,
    };
  }
  return result;
};

export const checkReproducibleFromScratch = (model: NetworkModel) => {
  const config = modelToConfig(model);
  if (!validateConfig(config)) {
    expect.fail(`Invalid config: ${JSON.stringify(config, null, 2)}\nValidation errors: ${JSON.stringify(validateConfig.errors, null, 2)}`);
  }
  const newModel = createDesiredModelFromBasicFeatures(config);
  expect(normalizeModel(model)).toEqual(normalizeModel(newModel));
};

export const validateModel = (model: NetworkModel) => {
  if (!validate(model)) {
    expect.fail(`Invalid model: ${JSON.stringify(model, null, 2)}\nValidation errors: ${JSON.stringify(validate.errors, null, 2)}`);
  }
};
