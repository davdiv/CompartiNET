import { BridgeMemberModel, InterfaceModel, InterfaceModelAltname, InterfaceModelBridge, NamespaceModel, NetworkModel, RouteModel } from "../../src/common/model/networkModel";
import { parseIpAddressModel } from "../../src/common/model/ip";

let testInodeCounter = 1;

export const createTestModel = (namespaces: { [name: string]: NamespaceModel }): NetworkModel => {
  const namedNetns: NetworkModel["namedNetns"] = {};
  const netnsById: NetworkModel["netnsById"] = {};
  for (const [name, ns] of Object.entries(namespaces)) {
    const id = testInodeCounter++;
    namedNetns[name] = id;
    netnsById[id] = ns;
  }
  return { namedNetns, netnsById };
};

export const ns = (model: NetworkModel, name: string): NamespaceModel => model.netnsById[model.namedNetns[name]];

export const createNamespace = (interfaces: Record<string, InterfaceModel> = {}, routes: RouteModel[] = []): NamespaceModel => ({
  interfaces,
  routes,
  listeningSockets: [],
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

export const createBridge = (up: boolean = true, addresses: string[] = [], vlanFiltering = false, stp = false): InterfaceModelBridge => ({
  up,
  addresses: addresses.map(parseIpAddressModel),
  altnames: [],
  type: "bridge",
  vlanFiltering,
  stp,
  self: {
    vlans: [{ vlanId: 1, untagged: true }],
    pvid: 1,
  },
});
