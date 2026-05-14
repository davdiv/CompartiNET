// Note that the action in this file is only intended to be used as a feature to create the correct desired state
// as there is obviously no command to create hardware

import { NetworkModel, InterfaceModelHardware } from "../networkModel";
import { checkIfaceNotExists, checkNetnsExists } from "../utils";

export interface MatchHardwareAction {
  type: "MatchHardware";
  netns: string;
  iface: string;
  hardwareBus?: string;
  hardwareDevice?: string;
  phy?: string;
}

export const newHardware = (hardwareBus?: string, hardwareDevice?: string, phy?: string): InterfaceModelHardware => ({
  type: "hardware",
  up: false,
  addresses: [],
  altnames: [],
  hardwareBus,
  hardwareDevice,
  phy,
  netnsImmutable: !!phy,
});

export const applyMatchHardware = (model: NetworkModel, { netns, iface, hardwareBus, hardwareDevice, phy }: MatchHardwareAction) => {
  const ns = checkNetnsExists(model, netns);
  checkIfaceNotExists(ns, netns, iface);
  ns.interfaces[iface] = newHardware(hardwareBus, hardwareDevice, phy);
};

export const commandForMatchHardware = () => {
  throw new Error("There is no command to match hardware!");
};
