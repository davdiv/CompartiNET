import { addInterface } from "./actions/utils";
import { parseIpAddressModel } from "./ip";
import { IPRoute2BridgeVlan, IPRoute2Interface, IPRoute2NetnsId, IPRoute2NetnsState, IPRoute2Route } from "./iproute2";
import { InterfaceModelBase, NamespaceModel, NetworkModel, RealInterfaceModel } from "./networkModel";
import { parseIwDev } from "./parseIwDev";
import { parseSsOutput } from "./parseSsOutput";
import { parseWgConfig } from "./wg/parser";

interface LookupMaps {
  nameToIno: Record<string, number>;
  nsidToName: Record<number, Record<number, string>>;
  ifindexToName: Record<number, Record<number, string>>;
}

const buildLookupMaps = (stateByNetns: IPRoute2NetnsState[]): LookupMaps => {
  const nameToIno: Record<string, number> = {};
  const nsidToName: Record<number, Record<number, string>> = {};
  const ifindexToName: Record<number, Record<number, string>> = {};

  for (const ns of stateByNetns) {
    for (const name of ns.name) {
      nameToIno[name] = ns.ino;
    }
    ifindexToName[ns.ino] = Object.fromEntries((ns.addr ?? []).map(({ ifindex, ifname }) => [ifindex, ifname]));
    nsidToName[ns.ino] = Object.fromEntries((ns.netnsIds ?? []).filter((entry): entry is IPRoute2NetnsId & { name: string } => !!entry.name).map(({ nsid, name }) => [nsid, name]));
  }

  return { nameToIno, nsidToName, ifindexToName };
};

interface BridgeVlanInfo {
  vlans: Array<{ vlanId: number; untagged: boolean }>;
  pvid?: number;
}

const buildBridgeVlanMap = (bridgeVlans: IPRoute2BridgeVlan[] | undefined): Record<string, BridgeVlanInfo> => {
  const map: Record<string, BridgeVlanInfo> = {};
  for (const bv of bridgeVlans ?? []) {
    const vlans: Array<{ vlanId: number; untagged: boolean }> = [];
    let pvid: number | undefined;
    for (const v of bv.vlans ?? []) {
      const flags = v.flags ?? [];
      const isPvid = flags.includes("PVID");
      const isUntagged = flags.includes("Egress Untagged");
      vlans.push({ vlanId: v.vlan, untagged: isUntagged });
      if (isPvid) {
        pvid = v.vlan;
      }
    }
    map[bv.ifname] = { vlans, pvid };
  }
  return map;
};

const resolveVethPeer = (iface: IPRoute2Interface, nsState: IPRoute2NetnsState, stateByNetns: IPRoute2NetnsState[], maps: LookupMaps): { peerNetns?: number; peerIface?: string } => {
  if (typeof iface.link === "string") {
    return { peerIface: iface.link, peerNetns: maps.nameToIno[nsState.name[0]] };
  }

  if (typeof iface.link_index === "number") {
    if (typeof iface.link_netnsid === "number") {
      const nsMap = maps.nsidToName[nsState.ino];
      if (nsMap) {
        const mappedName = nsMap[iface.link_netnsid];
        if (mappedName) {
          const peerNetns = maps.nameToIno[mappedName];
          const ifMap = maps.ifindexToName[peerNetns];
          if (ifMap) {
            const peerIface = ifMap[iface.link_index];
            if (peerIface) {
              return { peerNetns, peerIface };
            }
          }
        }
      }
    }

    // Fallback: bidirectional scan across all namespaces
    for (const otherNs of stateByNetns) {
      if (otherNs.ino === nsState.ino) continue;
      const candidate = otherNs.addr?.find((i) => i.ifindex === iface.link_index && i.linkinfo?.info_kind === "veth");
      if (candidate) {
        const candidatePeerIndex = candidate.link_index ?? (typeof candidate.link === "number" ? candidate.link : undefined);
        if (candidatePeerIndex === iface.ifindex) {
          return { peerNetns: maps.nameToIno[otherNs.name[0]], peerIface: candidate.ifname };
        }
      }
    }
  }

  return {};
};

const buildInterfaceBase = (iface: IPRoute2Interface, bridgeVlanMap: Record<string, BridgeVlanInfo>): InterfaceModelBase => {
  const base: InterfaceModelBase = {
    up: iface.flags?.includes("UP") ?? false,
    addresses: iface.addr_info.map((addr) => ({
      family: addr.family === "inet6" ? "ipv6" : "ipv4",
      address: addr.local,
      prefixLength: addr.prefixlen,
    })),
    altnames: iface.altnames ?? [],
    mtu: iface.mtu,
    macAddress: iface.address,
  };

  if (iface["netns-immutable"]) {
    base.netnsImmutable = true;
  }

  if (iface.master) {
    const bridgeVlanInfo = bridgeVlanMap[iface.ifname];
    base.bridgeMember = {
      bridge: iface.master,
      vlans: bridgeVlanInfo?.vlans ?? [],
      pvid: bridgeVlanInfo?.pvid,
    };
  }

  return base;
};

const buildInterfaceModel = (
  iface: IPRoute2Interface,
  nsState: IPRoute2NetnsState,
  stateByNetns: IPRoute2NetnsState[],
  maps: LookupMaps,
  bridgeVlanMap: Record<string, BridgeVlanInfo>,
  iwDev: Record<string, string>,
): RealInterfaceModel => {
  const base = buildInterfaceBase(iface, bridgeVlanMap);
  const infoKind = iface.linkinfo?.info_kind;

  if (iface.link_type === "loopback") {
    return { ...base, type: "loopback", netnsImmutable: true };
  }

  if (!infoKind) {
    return { ...base, type: "hardware", hardwareBus: iface.parentbus, hardwareDevice: iface.parentdev, phy: iwDev[iface.ifname] };
  }

  if (infoKind === "bridge") {
    const selfVlanInfo = bridgeVlanMap[iface.ifname];
    return {
      ...base,
      type: "bridge",
      netnsImmutable: true,
      vlanFiltering: !!iface.linkinfo?.info_data?.vlan_filtering,
      stp: !!iface.linkinfo?.info_data?.stp_state,
      self: {
        vlans: selfVlanInfo?.vlans ?? [],
        pvid: selfVlanInfo?.pvid,
      },
    };
  }

  if (infoKind === "veth") {
    const { peerNetns, peerIface } = resolveVethPeer(iface, nsState, stateByNetns, maps);
    return { ...base, type: "veth", peerNetns, peerIface };
  }

  if (infoKind === "wireguard") {
    const wgConf = nsState.wireguard?.[iface.ifname];
    if (wgConf) {
      return { ...base, type: "wireguard", config: parseWgConfig(wgConf) };
    }
    return { ...base, type: "wireguard", config: { peers: [] } };
  }

  return { ...base, type: "unknown" };
};

const parseRouteDestination = (route: IPRoute2Route): import("./networkModel").IpAddressModel => {
  const gateway = route.gateway ? parseIpAddressModel(route.gateway) : null;

  if (route.dst === "default") {
    if (gateway) {
      return {
        family: gateway.family,
        address: gateway.family === "ipv6" ? "0:0:0:0:0:0:0:0" : "0.0.0.0",
        prefixLength: 0,
      };
    }
    return { family: "ipv4", address: "0.0.0.0", prefixLength: 0 };
  }

  const dst = parseIpAddressModel(route.dst);
  if (gateway?.family && gateway.family !== dst.family) {
    throw new Error("Inconsistent route");
  }
  return dst;
};

const buildRouteModels = (routes: IPRoute2Route[]): import("./networkModel").RouteModel[] =>
  routes
    .filter((r) => r.protocol !== "kernel")
    .map((route) => {
      const gateway = route.gateway ? parseIpAddressModel(route.gateway) : null;
      const dst = parseRouteDestination(route);
      return {
        ...dst,
        gateway: gateway?.address,
        iface: route.dev,
        metric: route.metric,
        ...(route.flags.includes("onlink") ? { onlink: true } : {}),
      };
    });

/**
 * Generates the Network Model (Actual State) from iproute2 JSON data.
 */
export function generateActualNetworkModel(stateByNetns: IPRoute2NetnsState[]): NetworkModel {
  const model: NetworkModel = { namedNetns: {}, netnsByIno: {} };
  const maps = buildLookupMaps(stateByNetns);

  for (const nsState of stateByNetns) {
    const bridgeVlanMap = buildBridgeVlanMap(nsState.bridgeVlans);
    const iwDev = parseIwDev(nsState.iwDev);

    const netnsModel: NamespaceModel = {
      names: [...nsState.name],
      interfaces: {},
      routes: buildRouteModels(nsState.route ?? []),
      listeningSockets: nsState.listeningSockets ? parseSsOutput(nsState.listeningSockets) : [],
    };

    for (const name of nsState.name) {
      model.namedNetns[name] = nsState.ino;
    }
    model.netnsByIno[nsState.ino] = netnsModel;

    for (const iface of nsState.addr ?? []) {
      const value = buildInterfaceModel(iface, nsState, stateByNetns, maps, bridgeVlanMap, iwDev);
      addInterface(netnsModel, iface.ifname, value);
    }
  }

  return model;
}
