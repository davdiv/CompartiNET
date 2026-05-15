import { addInterface } from "./actions/utils";
import { parseIpAddressModel } from "./ip";
import { IPRoute2NetnsState } from "./iproute2";
import { InterfaceModel, InterfaceModelBase, NamespaceModel, NetworkModel } from "./networkModel";
import { parseIwDev } from "./parseIwDev";
import { parseSsOutput } from "./parseSsOutput";
import { parseWgConfig } from "./wg/parser";

/**
 * Generates the Network Model (Actual State) from iproute2 JSON data.
 */
export function generateActualNetworkModel(stateByNetns: IPRoute2NetnsState[]): NetworkModel {
  const model: NetworkModel = {
    namedNetns: {},
    netnsByIno: {},
  };

  const nameMap: Record<string, number> = {};
  const nsidMap: Record<number, Record<number, string>> = {};
  const ifindexMap: Record<number, Record<number, string>> = {};

  for (const nsState of stateByNetns) {
    for (const name of nsState.name) {
      nameMap[name] = nsState.ino;
    }
    ifindexMap[nsState.ino] = Object.fromEntries((nsState.addr ?? []).map(({ ifindex, ifname }) => [ifindex, ifname]));
    nsidMap[nsState.ino] = Object.fromEntries((nsState.netnsIds ?? []).filter(({ name }) => !!name).map(({ nsid, name }) => [nsid, name!]));
  }

  for (const nsState of stateByNetns) {
    const netnsModel: NamespaceModel = {
      names: [...nsState.name],
      interfaces: {},
      routes: [],
      listeningSockets: [],
    };
    for (const name of nsState.name) {
      model.namedNetns[name] = nsState.ino;
    }
    model.netnsByIno[nsState.ino] = netnsModel;
    const iwDev = parseIwDev(nsState.iwDev);

    // Build map of bridge VLAN info per interface
    const bridgeVlanMap: Record<string, { vlans: Array<{ vlanId: number; untagged: boolean }>; pvid?: number }> = {};
    for (const bv of nsState.bridgeVlans || []) {
      const vlans: Array<{ vlanId: number; untagged: boolean }> = [];
      let pvid: number | undefined;
      for (const v of bv.vlans || []) {
        const flags = v.flags || [];
        const isPvid = flags.includes("PVID");
        const isUntagged = flags.includes("Egress Untagged");
        vlans.push({ vlanId: v.vlan, untagged: isUntagged });
        if (isPvid) {
          pvid = v.vlan;
        }
      }
      bridgeVlanMap[bv.ifname] = { vlans, pvid };
    }

    const interfaces = nsState.addr || [];
    for (const iface of interfaces) {
      const base: Omit<InterfaceModelBase, "type"> = {
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
        const bridgeVlanInfo = Object.hasOwn(bridgeVlanMap, iface.ifname) ? bridgeVlanMap[iface.ifname] : undefined;
        base.bridgeMember = {
          bridge: iface.master,
          vlans: bridgeVlanInfo?.vlans ?? [],
          pvid: bridgeVlanInfo?.pvid,
        };
      }

      const infoKind = iface.linkinfo?.info_kind;

      let value: InterfaceModel;

      if (iface.link_type === "loopback") {
        value = {
          ...base,
          type: "loopback",
          netnsImmutable: true,
        };
      } else if (!infoKind) {
        value = { ...base, type: "hardware", hardwareBus: iface.parentbus, hardwareDevice: iface.parentdev, phy: Object.hasOwn(iwDev, iface.ifname) ? iwDev[iface.ifname] : undefined };
      } else if (infoKind === "bridge") {
        const selfVlanInfo = Object.hasOwn(bridgeVlanMap, iface.ifname) ? bridgeVlanMap[iface.ifname] : undefined;
        value = {
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
      } else if (infoKind === "veth") {
        let peerNetns = 0;
        let peerIface = "";
        if (typeof iface.link === "string") {
          peerIface = iface.link;
          peerNetns = nameMap[nsState.name[0]];
        } else if (typeof iface.link_index === "number") {
          if (typeof iface.link_netnsid === "number") {
            const nsMap = Object.hasOwn(nsidMap, nsState.ino) ? nsidMap[nsState.ino] : undefined;
            if (nsMap) {
              const mappedNs = Object.hasOwn(nsMap, iface.link_netnsid) ? nsMap[iface.link_netnsid] : undefined;
              if (mappedNs) {
                peerNetns = nameMap[mappedNs];
                const ifMap = Object.hasOwn(ifindexMap, nameMap[mappedNs]) ? ifindexMap[nameMap[mappedNs]] : undefined;
                peerIface = ifMap && Object.hasOwn(ifMap, iface.link_index) ? ifMap[iface.link_index] : "";
              }
            }
          }
          // Fallback: bidirectional scan across all namespaces
          // TODO: avoid this
          if (!peerIface) {
            for (const otherNs of stateByNetns) {
              // The peer must be in a different namespace (same-namespace peers are handled above
              // via `typeof iface.link === "string"`). Skipping the current namespace here prevents
              // a false self-match when both ends of the veth pair share the same ifindex, which
              // happens in fresh unshare'd namespaces where interface indices reset to 1.
              if (otherNs.ino === nsState.ino) continue;
              const candidate = otherNs.addr?.find((i) => i.ifindex === iface.link_index && i.linkinfo?.info_kind === "veth");
              if (candidate) {
                const candidatePeerIndex = candidate.link_index ?? (typeof candidate.link === "number" ? candidate.link : undefined);
                if (candidatePeerIndex === iface.ifindex) {
                  peerNetns = nameMap[otherNs.name[0]];
                  peerIface = candidate.ifname;
                  break;
                }
              }
            }
          }
        }
        value = { ...base, type: "veth", peerNetns, peerIface };
      } else if (infoKind === "wireguard") {
        const wgConf = nsState.wireguard && Object.hasOwn(nsState.wireguard, iface.ifname) ? nsState.wireguard[iface.ifname] : undefined;
        if (wgConf) {
          const parsed = parseWgConfig(wgConf);
          value = {
            ...base,
            type: "wireguard",
            config: parsed,
          };
        } else {
          value = { ...base, type: "wireguard", config: { peers: [] } };
        }
      } else {
        value = { ...base, type: "unknown" };
      }

      addInterface(netnsModel, iface.ifname, value);
    }

    // Map routes
    const routes = nsState.route || [];
    for (const route of routes) {
      if (route.protocol === "kernel") {
        continue;
      }
      const gateway = route.gateway ? parseIpAddressModel(route.gateway) : null;
      let dst: import("./networkModel").IpAddressModel;
      if (route.dst === "default") {
        if (gateway) {
          dst = {
            family: gateway.family,
            address: gateway.family === "ipv6" ? "0:0:0:0:0:0:0:0" : "0.0.0.0",
            prefixLength: 0,
          };
        } else {
          // TODO: what about default IPv6 routes?
          dst = {
            family: "ipv4",
            address: "0.0.0.0",
            prefixLength: 0,
          };
        }
      } else {
        dst = parseIpAddressModel(route.dst);
      }
      if (gateway?.family && gateway.family !== dst.family) {
        throw new Error("Inconsistent route");
      }
      netnsModel.routes.push({
        ...dst,
        gateway: gateway?.address,
        iface: route.dev,
        metric: route.metric,
        ...(route.flags.includes("onlink") ? { onlink: true } : {}),
      });
    }

    if (nsState.listeningSockets) {
      netnsModel.listeningSockets = parseSsOutput(nsState.listeningSockets);
    }
  }

  return model;
}
