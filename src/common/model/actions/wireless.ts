import { Command, getNetnsTarget } from "../commands";
import { InterfaceModelHardware, NetworkModel } from "../networkModel";
import { checkNetnsExists } from "../utils";
import { checkThenMoveInterface } from "./utils";

export interface MoveWirelessPhyAction {
  type: "MoveWirelessPhy";
  phy: string;
  oldNetns: string;
  newNetns: string;
}

export const applyMoveWirelessPhy = (model: NetworkModel, { phy, oldNetns, newNetns }: MoveWirelessPhyAction) => {
  // TODO: store phy objects on each netns and allow adding/removing wlan devices from phy objects
  const oldNetnsModel = checkNetnsExists(model, oldNetns);
  if (oldNetns === newNetns) {
    return;
  }

  // Find all interfaces on this phy in oldNetns and move them to newNetns
  // (moving a phy via iw moves ALL its interfaces with their altnames)
  const ifacesOnPhy = Object.entries(oldNetnsModel.interfaces).filter((entry): entry is [string, InterfaceModelHardware] => entry[1].type === "hardware" && entry[1].phy === phy);

  const applyMoves = ifacesOnPhy.map(([iface]) => checkThenMoveInterface(model, oldNetns, newNetns, iface, iface, true));
  for (const applyMove of applyMoves) {
    applyMove();
  }
};

export const commandForMoveWirelessPhy = ({ phy, oldNetns, newNetns }: MoveWirelessPhyAction): Command => ({
  netns: oldNetns,
  args: ["iw", "phy", phy, "set", "netns", "name", getNetnsTarget(newNetns)],
});
