import { newBridge } from "../../src/common/model/actions/bridge";
import { newNetns } from "../../src/common/model/actions/namespace";
import { BridgeMemberModel, InterfaceModel, InterfaceModelAltname, InterfaceModelBridge, NamespaceModel, NetworkModel, RealInterfaceModel, RouteModel } from "../../src/common/model/networkModel";
import { parseIpAddressModel } from "../../src/common/model/ip";

let testInodeCounter = 1;

export const createTestModel = (namespaces: { [name: string]: Omit<NamespaceModel, "names"> }): NetworkModel => {
  const namedNetns: NetworkModel["namedNetns"] = {};
  const netnsById: NetworkModel["netnsByIno"] = {};
  for (const [name, ns] of Object.entries(namespaces)) {
    const id = testInodeCounter++;
    namedNetns[name] = id;
    netnsById[id] = { ...ns, names: [name] };
  }
  return { namedNetns, netnsByIno: netnsById };
};

export const ns = (model: NetworkModel, name: string): NamespaceModel => model.netnsByIno[model.namedNetns[name]];

export const getRealIface = (model: NetworkModel, netns: string, iface: string): RealInterfaceModel => ns(model, netns).interfaces[iface] as RealInterfaceModel;

// Thin wrappers around the source-of-truth factories in src/common/model/actions/,
// so model-shape refactors propagate to tests automatically.
export const createNamespace = (interfaces: Record<string, InterfaceModel> = {}, routes: RouteModel[] = []): NamespaceModel => {
  const out = newNetns();
  Object.assign(out.interfaces, interfaces);
  out.routes = routes;
  return out;
};

export const createBridge = (up: boolean = true, addresses: string[] = [], vlanFiltering = false, stp = false): InterfaceModelBridge => ({
  ...newBridge(vlanFiltering, stp),
  up,
  addresses: addresses.map(parseIpAddressModel),
});

export const createInterface = (up: boolean = true, addresses: string[] = [], bridgeMember?: BridgeMemberModel, altnames: string[] = []): InterfaceModel => ({
  up,
  addresses: addresses.map(parseIpAddressModel),
  type: "unknown",
  bridgeMember,
  altnames,
});

export const createAltname = (iface: string): InterfaceModelAltname => ({
  type: "altname",
  iface,
});

export const createBridgeMember = (bridge: string, vlans: Array<{ vlanId: number; untagged: boolean }> = [], pvid?: number): BridgeMemberModel => ({
  bridge,
  vlans,
  pvid,
});
