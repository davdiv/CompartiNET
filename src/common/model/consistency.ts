import { formatSocket } from "./actions/socket";
import { formatIpAddressModel, parseIpAddressModel } from "./ip";
import {
  BridgeMemberModel,
  BridgeMemberVlanModel,
  InterfaceModelAltname,
  InterfaceModelVeth,
  ListeningSocket,
  NamespaceModel,
  NetnsIno,
  NetworkModel,
  RealInterfaceModel,
  RouteModel,
} from "./networkModel";
import { getIface, inconsistentModelFailure, requireNetnsName } from "./utils";

const checkVlanPvid = (membership: { vlans: BridgeMemberVlanModel[]; pvid?: number }, context: string) => {
  if (membership.pvid == null) return;
  if (!membership.vlans.some((v) => v.vlanId === membership.pvid)) {
    throw inconsistentModelFailure(`${context} has pvid ${membership.pvid} which is not in its vlans`);
  }
};

const checkAltnameStub = (netns: string, ns: NamespaceModel, ifaceName: string, stub: InterfaceModelAltname) => {
  const target = getIface(ns, stub.iface);
  if (!target) {
    throw inconsistentModelFailure(`Altname ${ifaceName} in namespace ${netns} points to missing interface ${stub.iface}`);
  }
  if (target.type === "altname") {
    throw inconsistentModelFailure(`Altname ${ifaceName} in namespace ${netns} points to altname-typed interface ${stub.iface}`);
  }
  if (!target.altnames.includes(ifaceName)) {
    throw inconsistentModelFailure(`Altname ${ifaceName} in namespace ${netns} is not listed in altnames of ${stub.iface}`);
  }
};

const checkRealIfaceAltnames = (netns: string, ns: NamespaceModel, ifaceName: string, iface: RealInterfaceModel) => {
  for (const altname of iface.altnames) {
    const stub = getIface(ns, altname);
    if (!stub) {
      throw inconsistentModelFailure(`Interface ${ifaceName} in namespace ${netns} lists altname ${altname} which is missing`);
    }
    if (stub.type !== "altname" || stub.iface !== ifaceName) {
      throw inconsistentModelFailure(`Altname ${altname} in namespace ${netns} does not point back to ${ifaceName}`);
    }
  }
};

const checkVethPeer = (model: NetworkModel, netnsIno: NetnsIno, netns: string, ifaceName: string, iface: InterfaceModelVeth) => {
  if (iface.peerNetns == null || iface.peerIface == null) {
    return;
  }
  if (iface.peerNetns === netnsIno && iface.peerIface === ifaceName) {
    throw inconsistentModelFailure(`Veth ${ifaceName} in namespace ${netns} is its own peer`);
  }
  if (!Object.hasOwn(model.netnsByIno, iface.peerNetns)) {
    return;
  }
  const peerNs = model.netnsByIno[iface.peerNetns];
  const peerNetnsName = requireNetnsName(model, iface.peerNetns);
  const peer = getIface(peerNs, iface.peerIface);
  if (!peer) {
    throw inconsistentModelFailure(`Veth ${ifaceName} in namespace ${netns} references missing peer ${iface.peerIface} in namespace ${peerNetnsName}`);
  }
  if (peer.type !== "veth") {
    throw inconsistentModelFailure(`Veth ${ifaceName} in namespace ${netns} peers with non-veth ${iface.peerIface} in namespace ${peerNetnsName}`);
  }
  if (peer.peerNetns !== netnsIno || peer.peerIface !== ifaceName) {
    throw inconsistentModelFailure(`Veth ${ifaceName} in namespace ${netns} has broken back-link from peer ${iface.peerIface} in namespace ${peerNetnsName}`);
  }
};

const checkBridgeMember = (netns: string, ns: NamespaceModel, ifaceName: string, member: BridgeMemberModel) => {
  const bridge = getIface(ns, member.bridge);
  if (!bridge) {
    throw inconsistentModelFailure(`Interface ${ifaceName} in namespace ${netns} references missing bridge ${member.bridge}`);
  }
  if (bridge.type !== "bridge") {
    throw inconsistentModelFailure(`Interface ${ifaceName} in namespace ${netns} references ${member.bridge} which is not a bridge (type=${bridge.type})`);
  }
  checkVlanPvid(member, `Bridge membership of ${ifaceName} in namespace ${netns}`);
};

const checkRoute = (netns: string, ns: NamespaceModel, route: RouteModel) => {
  const iface = getIface(ns, route.iface);
  if (!iface) {
    throw inconsistentModelFailure(`Route ${formatIpAddressModel(route)} in namespace ${netns} references missing interface ${route.iface}`);
  }
  if (iface.type === "altname") {
    throw inconsistentModelFailure(`Route ${formatIpAddressModel(route)} in namespace ${netns} references altname ${route.iface}`);
  }
  if (route.gateway) {
    const gw = parseIpAddressModel(route.gateway);
    if (gw.family !== route.family) {
      throw inconsistentModelFailure(`Route ${formatIpAddressModel(route)} in namespace ${netns} has gateway ${route.gateway} of mismatched family`);
    }
  }
};

const checkListeningSockets = (netns: string, sockets: ListeningSocket[]) => {
  const seen = new Set<string>();
  for (const s of sockets) {
    const key = `${s.protocol}\0${s.host}\0${s.zone ?? ""}\0${s.port}`;
    if (seen.has(key)) {
      throw inconsistentModelFailure(`Duplicate listening socket ${formatSocket(s)} in namespace ${netns}`);
    }
    seen.add(key);
  }
};

export const checkModelConsistency = (model: NetworkModel) => {
  if (!Object.hasOwn(model.namedNetns, "")) {
    throw inconsistentModelFailure(`Default namespace "" is missing from namedNetns`);
  }
  for (const [name, ino] of Object.entries(model.namedNetns)) {
    if (!Object.hasOwn(model.netnsByIno, ino)) {
      throw inconsistentModelFailure(`Namespace ${name} maps to missing inode ${ino}`);
    }
    if (!model.netnsByIno[ino].names.includes(name)) {
      throw inconsistentModelFailure(`Namespace ${name} maps to inode ${ino} but is missing from its names back-reference`);
    }
  }

  for (const inoStr of Object.keys(model.netnsByIno)) {
    const ino = Number(inoStr);
    const ns = model.netnsByIno[ino];
    for (const name of ns.names) {
      if (!Object.hasOwn(model.namedNetns, name)) {
        throw inconsistentModelFailure(`Inode ${ino} lists name ${name} which is missing from namedNetns`);
      }
      if (model.namedNetns[name] !== ino) {
        throw inconsistentModelFailure(`Inode ${ino} lists name ${name} but namedNetns maps it to inode ${model.namedNetns[name]}`);
      }
    }
    const netns = requireNetnsName(model, ino);

    for (const [ifaceName, iface] of Object.entries(ns.interfaces)) {
      if (iface.type === "altname") {
        checkAltnameStub(netns, ns, ifaceName, iface);
        continue;
      }
      checkRealIfaceAltnames(netns, ns, ifaceName, iface);
      if (iface.type === "veth") {
        checkVethPeer(model, ino, netns, ifaceName, iface);
      }
      if (iface.bridgeMember) {
        checkBridgeMember(netns, ns, ifaceName, iface.bridgeMember);
      }
      if (iface.type === "bridge") {
        checkVlanPvid(iface.self, `Bridge ${ifaceName} self in namespace ${netns}`);
      }
    }

    for (const route of ns.routes) {
      checkRoute(netns, ns, route);
    }

    checkListeningSockets(netns, ns.listeningSockets);
  }
};
