import { NamespaceModel, NetworkModel, RealInterfaceModel } from "../networkModel";
import { checkIfaceExists, checkIfaceNotExists, checkNetnsExists, inconsistentModelFailure, requireNetnsName } from "../utils";

export const checkAltnamesNotExist = (netns: string, netnsModel: NamespaceModel, { altnames }: RealInterfaceModel) => {
  for (const altname of altnames) {
    checkIfaceNotExists(netnsModel, netns, altname);
  }
};

export const addAllAltnames = (netnsModel: NamespaceModel, iface: string, { altnames }: RealInterfaceModel) => {
  const ifaces = netnsModel.interfaces;
  for (const altname of altnames) {
    ifaces[altname] = { type: "altname", iface };
  }
};

export const addInterface = (netnsModel: NamespaceModel, iface: string, ifaceModel: RealInterfaceModel) => {
  netnsModel.interfaces[iface] = ifaceModel;
  addAllAltnames(netnsModel, iface, ifaceModel);
};

export const removeAllAltnames = (netnsModel: NamespaceModel, { altnames }: RealInterfaceModel) => {
  const ifaces = netnsModel.interfaces;
  for (const altname of altnames) {
    delete ifaces[altname];
  }
};

export const removeDeviceRoutes = (netnsModel: NamespaceModel, iface: string) => {
  netnsModel.routes = netnsModel.routes.filter((route) => route.iface !== iface);
};

export const removeInterface = (model: NetworkModel, netns: string, altname: string, skipRmRoutes = false) => {
  const { netnsModel, iface, ifaceModel } = checkIfaceExists(model, netns, altname);
  if (!skipRmRoutes && ifaceModel.up) {
    removeDeviceRoutes(netnsModel, iface);
  }
  removeAllAltnames(netnsModel, ifaceModel);
  delete netnsModel.interfaces[iface];
};

export const checkThenMoveInterface = (model: NetworkModel, oldNetns: string, newNetns: string, oldAltname: string, newIface: string, skipNetnsImmutableCheck = false) => {
  const { netnsModel: oldNetnsModel, iface: oldIface, ifaceModel } = checkIfaceExists(model, oldNetns, oldAltname);
  if (!skipNetnsImmutableCheck && oldNetns !== newNetns && ifaceModel.netnsImmutable) {
    throw new Error(`Interface ${oldIface} in namespace ${oldNetns} cannot be moved to another namespace.`);
  }
  const newNetnsModel = checkNetnsExists(model, newNetns);
  checkIfaceNotExists(newNetnsModel, newNetns, newIface);

  const sameNetns = oldNetns === newNetns;
  if (!sameNetns) {
    checkAltnamesNotExist(newNetns, newNetnsModel, ifaceModel);
  }

  return () => {
    if (sameNetns && oldIface === newIface) return;
    removeInterface(model, oldNetns, oldIface, sameNetns);
    if (!sameNetns) {
      delete ifaceModel.bridgeMember;
      ifaceModel.up = false;
    }
    addInterface(newNetnsModel, newIface, ifaceModel);

    if (sameNetns && ifaceModel.up) {
      for (const route of oldNetnsModel.routes) {
        if (route.iface === oldIface) {
          route.iface = newIface;
        }
      }
    }

    if (ifaceModel.type === "veth") {
      const oldId = model.namedNetns[oldNetns];
      const newId = model.namedNetns[newNetns];
      const peerName = requireNetnsName(model, ifaceModel.peerNetns);
      const { ifaceModel: peerIfaceModel, altnameModel } = checkIfaceExists(model, peerName, ifaceModel.peerIface);
      // TODO: maybe refactor this with a shared checkVethPeerExists ?
      if (altnameModel || peerIfaceModel.type !== "veth" || peerIfaceModel.peerNetns !== oldId || peerIfaceModel.peerIface !== oldIface) {
        throw inconsistentModelFailure(`Invalid peer`);
      }
      peerIfaceModel.peerNetns = newId;
      peerIfaceModel.peerIface = newIface;
    } else if (ifaceModel.type === "bridge") {
      if (sameNetns) {
        for (const member of Object.values(newNetnsModel.interfaces)) {
          if (member.type !== "altname" && member.bridgeMember?.bridge === oldIface) {
            member.bridgeMember.bridge = newIface;
          }
        }
      }
    }
  };
};
