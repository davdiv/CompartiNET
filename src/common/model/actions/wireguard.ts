import { Command, getIpNetnsPrefix, getNetnsPrefix } from "../commands";
import { InterfaceModelWireguard, NetnsInode, NetworkModel, WireguardConfig } from "../networkModel";
import { checkIfaceExists, checkIfaceNotExists, checkNetnsExists } from "../utils";
import { formatWgConfig } from "../wg/formatter";
import { removeInterface } from "./utils";

export interface CreateWireguardAction {
  type: "CreateWireguard";
  netns: string;
  iface: string;
}

export interface DeleteWireguardAction {
  type: "DeleteWireguard";
  netns: string;
  iface: string;
}

export interface SetWireguardConfigAction {
  type: "SetWireguardConfig";
  netns: string;
  iface: string;
  config: WireguardConfig;
}

export const newWireguard = (birthNetns?: NetnsInode): InterfaceModelWireguard => ({
  type: "wireguard",
  birthNetns,
  up: false,
  addresses: [],
  altnames: [],
  mtu: 1420,
  config: { peers: [] },
});

export const applyCreateWireguard = (model: NetworkModel, { netns, iface }: CreateWireguardAction) => {
  const ns = checkNetnsExists(model, netns);
  checkIfaceNotExists(ns, netns, iface);
  ns.interfaces[iface] = newWireguard(model.namedNetns[netns]);
};

const checkWgExists = (model: NetworkModel, netns: string, ifaceOrAltname: string): ReturnType<typeof checkIfaceExists> & { ifaceModel: InterfaceModelWireguard } => {
  const { ifaceModel, ...rest } = checkIfaceExists(model, netns, ifaceOrAltname);
  if (ifaceModel.type !== "wireguard") {
    throw new Error(`Interface ${ifaceOrAltname} in namespace ${netns} is not a wireguard interface`);
  }
  return { ifaceModel, ...rest };
};

export const applyDeleteWireguard = (model: NetworkModel, { netns, iface }: DeleteWireguardAction) => {
  checkWgExists(model, netns, iface);
  removeInterface(model, netns, iface);
};

export const applySetWireguardConfig = (model: NetworkModel, { netns, iface, config }: SetWireguardConfigAction) => {
  const { ifaceModel } = checkWgExists(model, netns, iface);
  // TODO: validate config ?
  ifaceModel.config = config;
};

export const commandForCreateWireguard = ({ netns, iface }: CreateWireguardAction) => [...getIpNetnsPrefix(netns), "link", "add", iface, "type", "wireguard"];

export const commandForDeleteWireguard = ({ netns, iface }: DeleteWireguardAction) => [...getIpNetnsPrefix(netns), "link", "del", iface];

export const commandForSetWireguardConfig = ({ netns, iface, config }: SetWireguardConfigAction): Command => [
  ...getNetnsPrefix(netns),
  "wg",
  "syncconf",
  iface,
  { type: "tempFile", content: formatWgConfig(config) },
];
