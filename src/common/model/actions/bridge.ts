import { getBridgeNetnsPrefix, getIpNetnsPrefix } from "../commands";
import { InterfaceModelBridge, NetworkModel } from "../networkModel";
import { checkIfaceExists, checkIfaceNotExists, checkNetnsExists } from "../utils";
import { removeInterface } from "./utils";

export interface CreateBridgeAction {
  type: "CreateBridge";
  netns: string;
  iface: string;
  vlanFiltering?: boolean;
  stp?: boolean;
}

export interface DeleteBridgeAction {
  type: "DeleteBridge";
  netns: string;
  iface: string;
}

export interface AddBridgePortAction {
  type: "AddBridgePort";
  netns: string;
  iface: string;
  bridge: string;
}

export interface RemoveBridgePortAction {
  type: "RemoveBridgePort";
  netns: string;
  iface: string;
}

export interface SetBridgeVlanFilteringAction {
  type: "SetBridgeVlanFiltering";
  netns: string;
  iface: string;
  vlanFiltering: boolean;
}

export interface AddBridgePortVlanAction {
  type: "AddBridgePortVlan";
  netns: string;
  iface: string;
  vlanId: number;
  untagged: boolean;
  pvid?: boolean;
  self?: boolean;
}

export interface RemoveBridgePortVlanAction {
  type: "RemoveBridgePortVlan";
  netns: string;
  iface: string;
  vlanId: number;
  self?: boolean;
}

export const newBridge = (vlanFiltering?: boolean, stp?: boolean): InterfaceModelBridge => ({
  type: "bridge",
  up: false,
  netnsImmutable: true,
  altnames: [],
  addresses: [],
  mtu: 1500,
  vlanFiltering: vlanFiltering ?? false,
  stp: stp ?? false,
  self: {
    vlans: [{ vlanId: 1, untagged: true }],
    pvid: 1,
  },
});

export const applyCreateBridge = (model: NetworkModel, { netns, iface, vlanFiltering, stp }: CreateBridgeAction) => {
  const ns = checkNetnsExists(model, netns);
  checkIfaceNotExists(ns, netns, iface);
  ns.interfaces[iface] = newBridge(vlanFiltering, stp);
};

export const checkBridgeExists = (model: NetworkModel, netns: string, ifaceOrAltname: string): ReturnType<typeof checkIfaceExists> & { ifaceModel: InterfaceModelBridge } => {
  const { ifaceModel, ...rest } = checkIfaceExists(model, netns, ifaceOrAltname);
  if (ifaceModel.type !== "bridge") {
    throw new Error(`Interface ${ifaceOrAltname} in namespace ${netns} is not a bridge`);
  }
  return { ifaceModel, ...rest };
};

export const applyDeleteBridge = (model: NetworkModel, { netns, iface: ifaceOrAltname }: DeleteBridgeAction) => {
  const { netnsModel: ns, iface } = checkBridgeExists(model, netns, ifaceOrAltname);
  removeInterface(model, netns, iface);
  // Deleting a bridge detaches all of its member interfaces
  for (const member of Object.values(ns.interfaces)) {
    if (member.type !== "altname" && member.bridgeMember?.bridge === iface) {
      delete member.bridgeMember;
    }
  }
};

export const applyAddBridgePort = (model: NetworkModel, { netns, iface, bridge: bridgeAltname }: AddBridgePortAction) => {
  const { ifaceModel } = checkIfaceExists(model, netns, iface);
  const { iface: bridge } = checkBridgeExists(model, netns, bridgeAltname);
  // The kernel initially assigns VLAN 1 as the default untagged PVID when a port
  // is added to a bridge, regardless of whether vlan_filtering is enabled. VLAN 1
  // can subsequently be removed via RemoveBridgePortVlan.
  ifaceModel.bridgeMember = { bridge, vlans: [{ vlanId: 1, untagged: true }], pvid: 1 };
};

export const applyRemoveBridgePort = (model: NetworkModel, { netns, iface }: RemoveBridgePortAction) => {
  const { ifaceModel } = checkIfaceExists(model, netns, iface);
  delete ifaceModel.bridgeMember;
};

const getBridgeMembership = (model: NetworkModel, netns: string, iface: string, self: boolean | undefined) => {
  const { ifaceModel } = checkIfaceExists(model, netns, iface);
  if (self) {
    if (ifaceModel.type !== "bridge") {
      throw new Error(`Interface ${iface} in namespace ${netns} is not a bridge`);
    }
    return ifaceModel.self;
  } else {
    if (!ifaceModel.bridgeMember) {
      throw new Error(`Interface ${iface} in namespace ${netns} is not a bridge port`);
    }
    return ifaceModel.bridgeMember;
  }
};

export const applyAddBridgePortVlan = (model: NetworkModel, { netns, iface, vlanId, untagged, pvid, self }: AddBridgePortVlanAction) => {
  const membership = getBridgeMembership(model, netns, iface, self);
  const existing = membership.vlans.find((v) => v.vlanId === vlanId);
  if (existing) {
    existing.untagged = untagged;
  } else {
    membership.vlans.push({ vlanId, untagged });
  }
  if (pvid) {
    membership.pvid = vlanId;
  } else if (existing && membership.pvid === vlanId) {
    delete membership.pvid;
  }
};

export const applyRemoveBridgePortVlan = (model: NetworkModel, { netns, iface, vlanId, self }: RemoveBridgePortVlanAction) => {
  const membership = getBridgeMembership(model, netns, iface, self);
  const idx = membership.vlans.findIndex((v) => v.vlanId === vlanId);
  if (idx === -1) {
    return;
  }
  membership.vlans.splice(idx, 1);
  if (membership.pvid === vlanId) {
    delete membership.pvid;
  }
};

export const applySetBridgeVlanFiltering = (model: NetworkModel, { netns, iface, vlanFiltering }: SetBridgeVlanFilteringAction) => {
  const { ifaceModel } = checkBridgeExists(model, netns, iface);
  ifaceModel.vlanFiltering = vlanFiltering;
};

export const commandForCreateBridge = ({ netns, iface, vlanFiltering, stp }: CreateBridgeAction) => {
  const cmd = [...getIpNetnsPrefix(netns), "link", "add", iface, "type", "bridge"];
  if (vlanFiltering) {
    cmd.push("vlan_filtering", "1");
  }
  if (stp === false) {
    cmd.push("stp_state", "0");
  } else if (stp === true) {
    cmd.push("stp_state", "1");
  }
  return cmd;
};

export const commandForDeleteBridge = ({ netns, iface }: DeleteBridgeAction) => [...getIpNetnsPrefix(netns), "link", "del", iface];

export const commandForAddBridgePort = ({ netns, iface, bridge }: AddBridgePortAction) => [...getIpNetnsPrefix(netns), "link", "set", iface, "master", bridge];

export const commandForRemoveBridgePort = ({ netns, iface }: RemoveBridgePortAction) => [...getIpNetnsPrefix(netns), "link", "set", iface, "nomaster"];

export const commandForSetBridgeVlanFiltering = ({ netns, iface, vlanFiltering }: SetBridgeVlanFilteringAction) => [
  ...getIpNetnsPrefix(netns),
  "link",
  "set",
  iface,
  "type",
  "bridge",
  "vlan_filtering",
  vlanFiltering ? "1" : "0",
];

export const commandForAddBridgePortVlan = ({ netns, iface, vlanId, untagged, pvid, self }: AddBridgePortVlanAction) => [
  ...getBridgeNetnsPrefix(netns),
  "vlan",
  "add",
  "dev",
  iface,
  "vid",
  `${vlanId}`,
  ...(pvid ? ["pvid"] : []),
  ...(untagged ? ["untagged"] : []),
  ...(self ? ["self"] : []),
];

export const commandForRemoveBridgePortVlan = ({ netns, iface, vlanId, self }: RemoveBridgePortVlanAction) => [
  ...getBridgeNetnsPrefix(netns),
  "vlan",
  "del",
  "dev",
  iface,
  "vid",
  `${vlanId}`,
  ...(self ? ["self"] : []),
];
