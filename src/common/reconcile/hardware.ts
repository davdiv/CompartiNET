import { MoveInterfaceAction } from "../model/actions/interface";
import { getHardwareInterfaceMap } from "../model/hardware";
import { checkIfaceExists, requireNetnsName } from "../model/utils";
import { ReconcileContext } from "./context";
import { diffRecord } from "./diff";
import { removeAllAltnames } from "./removeInterfaces";

type PhyInfo = { phy: string; oldNetns: string; newNetns: string; inconsistent: boolean; futureActions: MoveInterfaceAction[] };

export function reconcileHardware(ctx: ReconcileContext) {
  const desiredHwMap = getHardwareInterfaceMap(ctx.desiredModel);
  const currentHwMap = getHardwareInterfaceMap(ctx.currentModel);
  const diffHwMap = diffRecord(currentHwMap, desiredHwMap);
  const phyToMove: PhyInfo[] = [];
  const phyMap = new Map<string, PhyInfo>();
  for (const hwId of diffHwMap.same) {
    const [currentHw, ...restCurrent] = currentHwMap[hwId];
    const [desiredHw, ...restDesired] = desiredHwMap[hwId];
    if (restCurrent.length > 0 || restDesired.length > 0) {
      ctx.errors.push(`Multiple devices with the same id ${hwId} were found. Moving or renaming those devices is not supported (yet).`);
      continue;
    }
    const curName = requireNetnsName(ctx.currentModel, currentHw.netns);
    const desName = requireNetnsName(ctx.desiredModel, desiredHw.netns);
    const differentNetns = curName !== desName;
    const different = differentNetns || currentHw.iface !== desiredHw.iface;
    const { ifaceModel } = checkIfaceExists(ctx.currentModel, curName, currentHw.iface, true);
    const phyName = ifaceModel.type === "hardware" ? ifaceModel.phy : undefined;
    const requirePhyMove = differentNetns && !!phyName;
    if (differentNetns) {
      removeAllAltnames(ctx, curName, ifaceModel);
      if (ifaceModel.up) {
        ctx.apply({ type: "SetInterfaceUp", netns: curName, iface: currentHw.iface, up: false });
      }
    }
    if (phyName) {
      let phyInfo = phyMap.get(phyName);
      if (!phyInfo) {
        phyInfo = { phy: phyName, oldNetns: curName, newNetns: desName, inconsistent: false, futureActions: [] };
        phyMap.set(phyName, phyInfo);
        if (differentNetns) {
          phyToMove.push(phyInfo);
        }
      } else if (phyInfo.newNetns !== desName) {
        if (!phyInfo.inconsistent) {
          ctx.addError(`Inconsistent target namespace for ${phyName}: both in ${phyInfo.newNetns} and ${desName}`);
          phyInfo.inconsistent = true;
        }
        continue;
      }
      if (differentNetns && !phyInfo.inconsistent) {
        const tmpIface = ctx.findUnusedIfaceName([curName, desName], [currentHw.iface, desiredHw.iface], [ifaceModel, checkIfaceExists(ctx.desiredModel, desName, desiredHw.iface).ifaceModel]);
        if (tmpIface !== currentHw.iface) {
          ctx.apply({ type: "MoveInterface", oldNetns: curName, newNetns: curName, oldIface: currentHw.iface, newIface: tmpIface });
        }
        if (tmpIface !== desiredHw.iface) {
          phyInfo.futureActions.push({ type: "MoveInterface", oldNetns: desName, newNetns: desName, oldIface: tmpIface, newIface: desiredHw.iface });
        }
      }
    } else if (differentNetns && ifaceModel.netnsImmutable) {
      ctx.addError(`${currentHw.iface} from ${curName} cannot be moved to netns ${desName}`);
      continue;
    }
    if (different && !requirePhyMove) {
      ctx.apply({
        type: "MoveInterface",
        oldNetns: curName,
        oldIface: currentHw.iface,
        newNetns: desName,
        newIface: desiredHw.iface,
      });
    }
  }
  for (const { inconsistent, phy, oldNetns, newNetns, futureActions } of phyToMove) {
    if (inconsistent) continue;
    ctx.apply({
      type: "MoveWirelessPhy",
      phy,
      oldNetns,
      newNetns,
    });
    for (const action of futureActions) {
      ctx.apply(action);
    }
  }
}
