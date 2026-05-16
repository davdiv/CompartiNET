import type { NetworkAction } from "../model/actions";
import { NetnsIno, NetworkModel } from "./networkModel";

export interface InterfaceRuntimeMeta {
  /** The namespace inode where a WireGuard interface was created. */
  birthNetns?: NetnsIno;
}

/** Keyed by [netnsInode][ifaceName] — the interface's CURRENT location. */
export type InterfaceRuntimeMetaMap = Record<number, Record<string, InterfaceRuntimeMeta>>;

/** Enriches a collected NetworkModel with runtime metadata and prunes stale entries. */
export function applyRuntimeMeta(model: NetworkModel, meta: InterfaceRuntimeMetaMap): void {
  for (const inodeStr of Object.keys(meta)) {
    const inode = +inodeStr;
    const nsModel = model.netnsByIno[inode];
    if (!nsModel) {
      delete meta[inode];
      continue;
    }
    const nsMeta = meta[inode];
    for (const ifaceName of Object.keys(nsMeta)) {
      if (!Object.hasOwn(nsModel.interfaces, ifaceName)) {
        delete nsMeta[ifaceName];
      } else {
        const ifaceModel = nsModel.interfaces[ifaceName];
        if (ifaceModel.type === "wireguard") {
          ifaceModel.birthNetns = nsMeta[ifaceName].birthNetns;
        }
      }
    }
    if (Object.keys(nsMeta).length === 0) {
      delete meta[inode];
    }
  }
}

/** Updates metadata after successfully executing an action. */
export function recordActionMeta(meta: InterfaceRuntimeMetaMap, action: NetworkAction, nameToInode: Record<string, number>) {
  if (action.type === "CreateWireguard") {
    const inode = nameToInode[action.netns];
    (meta[inode] ??= {})[action.iface] = { birthNetns: inode };
  } else if (action.type === "MoveInterface") {
    const oldInode = nameToInode[action.oldNetns];
    const newInode = nameToInode[action.newNetns];
    const entry = meta[oldInode]?.[action.oldIface];
    if (entry) {
      (meta[newInode] ??= {})[action.newIface] = entry;
      delete meta[oldInode][action.oldIface];
      if (Object.keys(meta[oldInode]).length === 0) delete meta[oldInode];
    }
  } else if (action.type === "DeleteWireguard") {
    const inode = nameToInode[action.netns];
    if (meta[inode]) {
      delete meta[inode][action.iface];
      if (Object.keys(meta[inode]).length === 0) delete meta[inode];
    }
  }
}
