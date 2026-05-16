import { MatchHardwareAction } from "./actions/hardware";
import { InterfaceLink, NetworkModel } from "./networkModel";

export const getHardwareInterfaceMap = (model: NetworkModel): Record<string, InterfaceLink[]> => {
  const map: Record<string, InterfaceLink[]> = {};
  for (const inodeStr of Object.keys(model.netnsByIno)) {
    const inode = Number(inodeStr);
    const netnsModel = model.netnsByIno[inode];
    for (const [iface, ifaceModel] of Object.entries(netnsModel.interfaces)) {
      if (ifaceModel.type === "hardware" && (ifaceModel.hardwareBus || ifaceModel.hardwareDevice)) {
        const hwId = `${ifaceModel.hardwareBus ?? ""}:${ifaceModel.hardwareDevice ?? ""}`;
        let items = Object.hasOwn(map, hwId) ? map[hwId] : undefined;
        if (!items) {
          items = [];
          map[hwId] = items;
        }
        items.push({
          netns: inode,
          iface: iface,
        });
      }
    }
  }
  return map;
};

export const getHardwareMatchActions = (model: NetworkModel): MatchHardwareAction[] => {
  const res: MatchHardwareAction[] = [];
  for (const netnsModel of Object.values(model.netnsByIno)) {
    const name = netnsModel.names[0];
    if (name == null) continue;
    for (const [iface, ifaceModel] of Object.entries(netnsModel.interfaces)) {
      if (ifaceModel.type === "hardware") {
        res.push({
          type: "MatchHardware",
          netns: name,
          iface,
          hardwareBus: ifaceModel.hardwareBus,
          hardwareDevice: ifaceModel.hardwareDevice,
          phy: ifaceModel.phy,
        });
      }
    }
  }
  return res;
};
