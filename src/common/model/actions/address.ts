import { getNetnsPrefix } from "../commands";
import { formatIpAddressModel } from "../ip";
import { IpAddressModel, NetworkModel } from "../networkModel";
import { checkIfaceExists } from "../utils";

export interface AddIpAddressAction {
  type: "AddIpAddress";
  netns: string;
  iface: string;
  ip: IpAddressModel;
}

export interface RemoveIpAddressAction {
  type: "RemoveIpAddress";
  netns: string;
  iface: string;
  ip: IpAddressModel;
}

export const applyAddIpAddress = (model: NetworkModel, { netns, iface, ip }: AddIpAddressAction) => {
  const { ifaceModel } = checkIfaceExists(model, netns, iface);
  if (ifaceModel.addresses.some((a) => a.address === ip.address && a.prefixLength === ip.prefixLength)) {
    throw new Error(`Address ${ip.address} already exists for interface ${iface} in namespace ${netns}`);
  }
  ifaceModel.addresses.push(ip);
};

export const applyRemoveIpAddress = (model: NetworkModel, { netns, iface, ip }: RemoveIpAddressAction) => {
  const { ifaceModel } = checkIfaceExists(model, netns, iface);
  const ipIndex = ifaceModel.addresses.findIndex((a) => a.address === ip.address && a.prefixLength === ip.prefixLength);
  if (ipIndex === -1) {
    throw new Error(`Address ${ip.address} does not exists for interface ${iface} in namespace ${netns}`);
  }
  ifaceModel.addresses.splice(ipIndex, 1);
};

export const commandForAddIpAddress = ({ netns, iface, ip }: AddIpAddressAction) => [
  ...getNetnsPrefix(netns),
  "ip",
  "addr",
  "add",
  formatIpAddressModel(ip),
  "dev",
  iface,
  ...(ip.family === "ipv6" ? ["nodad"] : []),
];

export const commandForRemoveIpAddress = ({ netns, iface, ip }: RemoveIpAddressAction) => [...getNetnsPrefix(netns), "ip", "addr", "del", formatIpAddressModel(ip), "dev", iface];
