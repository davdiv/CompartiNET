import { CommandArg, getIpNetnsPrefix, getNetnsTarget } from "../commands";
import { InterfaceModelVeth, NetnsIno, NetworkModel } from "../networkModel";
import { checkIfaceExists, checkIfaceNotExists, checkNetnsExists, requireNetnsName } from "../utils";
import { removeInterface } from "./utils";

export interface CreateVethAction {
  type: "CreateVeth";
  netns: string;
  iface: string;
  peerNetns: string;
  peerIface: string;
}

export interface DeleteVethAction {
  type: "DeleteVeth";
  netns: string;
  iface: string;
}

export const newVeth = (peerNetns?: NetnsIno, peerIface?: string): InterfaceModelVeth => ({
  type: "veth",
  up: false,
  addresses: [],
  altnames: [],
  mtu: 1500,
  peerNetns,
  peerIface,
});

export const applyCreateVeth = (model: NetworkModel, { netns, iface, peerNetns, peerIface }: CreateVethAction) => {
  const ns = checkNetnsExists(model, netns);
  checkIfaceNotExists(ns, netns, iface);
  const peerNs = checkNetnsExists(model, peerNetns);
  checkIfaceNotExists(peerNs, peerNetns, peerIface);
  const netnsInode = model.namedNetns[netns];
  const peerNetnsInode = model.namedNetns[peerNetns];
  ns.interfaces[iface] = newVeth(peerNetnsInode, peerIface);
  peerNs.interfaces[peerIface] = newVeth(netnsInode, iface);
};

export const applyDeleteVeth = (model: NetworkModel, { netns, iface }: DeleteVethAction) => {
  const { ifaceModel } = checkIfaceExists(model, netns, iface);
  if (ifaceModel.type !== "veth") {
    throw new Error(`Interface ${iface} in namespace ${netns} is not a veth`);
  }
  // Also remove the peer if known
  if (ifaceModel.peerNetns != null && ifaceModel.peerIface != null) {
    const peerName = requireNetnsName(model, ifaceModel.peerNetns);
    removeInterface(model, peerName, ifaceModel.peerIface);
  }
  removeInterface(model, netns, iface);
};

export const commandForCreateVeth = ({ netns, iface, peerNetns, peerIface }: CreateVethAction) => {
  const cmd: CommandArg[] = [...getIpNetnsPrefix(netns), "link", "add", "dev", iface, "type", "veth", "peer", "name", peerIface];
  if (peerNetns !== netns) {
    cmd.push("netns", getNetnsTarget(peerNetns));
  }
  return cmd;
};

export const commandForDeleteVeth = ({ netns, iface }: DeleteVethAction) => [...getIpNetnsPrefix(netns), "link", "del", "dev", iface];
