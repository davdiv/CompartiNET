import { Command, getNetnsTarget } from "../commands";
import { NetworkModel } from "../networkModel";
import { checkIfaceExists } from "../utils";
import { checkThenMoveInterface, removeDeviceRoutes } from "./utils";

export interface MoveInterfaceAction {
  type: "MoveInterface";
  oldNetns: string;
  oldIface: string;
  newNetns: string;
  newIface: string;
}

export interface SetInterfaceUpAction {
  type: "SetInterfaceUp";
  netns: string;
  iface: string;
  up: boolean;
}

export const applyMoveInterface = (model: NetworkModel, { oldNetns, oldIface, newNetns, newIface }: MoveInterfaceAction) => {
  checkThenMoveInterface(model, oldNetns, newNetns, oldIface, newIface)();
};

export const applySetInterfaceUp = (model: NetworkModel, { netns, iface: altname, up }: SetInterfaceUpAction) => {
  const { netnsModel: ns, ifaceModel, iface } = checkIfaceExists(model, netns, altname);
  up = !!up;
  if (ifaceModel.up != up) {
    ifaceModel.up = up;
    if (up) {
      if (ifaceModel.type === "loopback") {
        if (!ifaceModel.addresses.some((a) => a.family === "ipv4" && a.address === "127.0.0.1" && a.prefixLength === 8)) {
          ifaceModel.addresses.unshift({ family: "ipv4", address: "127.0.0.1", prefixLength: 8 });
        }
        if (!ifaceModel.addresses.some((a) => a.family === "ipv6" && a.address === "::1" && a.prefixLength === 128)) {
          ifaceModel.addresses.unshift({ family: "ipv6", address: "::1", prefixLength: 128 });
        }
      }
    } else {
      removeDeviceRoutes(ns, iface);
      ifaceModel.addresses = ifaceModel.addresses.filter((a) => a.family !== "ipv6");
    }
  }
};

export const commandForMoveInterface = ({ oldNetns, oldIface, newNetns, newIface }: MoveInterfaceAction): Command => ({
  netns: oldNetns,
  args: [
    "ip",
    "link",
    "set",
    "dev",
    oldIface,
    // always include  the name because the oldIface may be an altname
    // and comparing an altname with the new name does not make sense
    "name",
    newIface,
    ...(oldNetns !== newNetns ? ["netns", getNetnsTarget(newNetns)] : []),
  ],
});

export const commandForSetInterfaceUp = ({ netns, iface, up }: SetInterfaceUpAction): Command => ({
  netns,
  args: ["ip", "link", "set", "dev", iface, up ? "up" : "down"],
});
