// cf https://github.com/iproute2/iproute2/blob/main/ip/ipaddress.c
export interface IPRoute2AddrInfo {
  family: "inet" | "inet6";
  local: string;
  prefixlen: number;
  scope: string;
  label?: string;
  valid_life_time?: number;
  preferred_life_time?: number;
  noprefixroute?: boolean;
}

export type IPRoute2InterfaceFlags = "LOOPBACK" | "UP" | "LOWER_UP" | "BROADCAST" | "MULTICAST" | "POINTOPOINT" | "NOARP";
export type IPRoute2OperStates = "UNKNOWN" | "NOTPRESENT" | "DOWN" | "LOWERLAYERDOWN" | "TESTING" | "DORMANT" | "UP";

export interface IPRoute2LinkInfo {
  info_kind?: string;
  info_data?: Record<string, unknown>;
}

export interface IPRoute2Interface {
  ifindex: number;
  ifname: string;
  flags: IPRoute2InterfaceFlags[];
  mtu: number;
  operstate: IPRoute2OperStates;
  link_type: "loopback" | "ether" | "none";
  address: string;
  broadcast: string;
  "netns-immutable"?: boolean;
  qdisc?: string;
  group?: string;
  txqlen?: number;
  addr_info: IPRoute2AddrInfo[];
  parentbus?: string;
  parentdev?: string;
  linkinfo?: IPRoute2LinkInfo;
  link?: string;
  link_index?: number;
  link_netnsid?: number;
  altnames?: string[];
  master?: string;
}

export interface IPRoute2BridgeVlanEntry {
  vlan: number;
  flags?: string[];
}

export interface IPRoute2BridgeVlan {
  ifname: string;
  vlans?: IPRoute2BridgeVlanEntry[];
}

export interface IPRoute2Route {
  dst: string;
  gateway: string;
  dev: string;
  protocol: string;
  scope: string;
  prefsrc: string;
  flags: string[];
  metric?: number;
  priority?: number;
}

export interface LsnsNetNamespace {
  ns: number;
  netnsid: string;
}

export interface IPRoute2NetnsState {
  ino: number;
  names: string[];
  addr: IPRoute2Interface[];
  route: IPRoute2Route[];
  wireguard?: Record<string, string>;
  lsns?: LsnsNetNamespace[];
  bridgeVlans?: IPRoute2BridgeVlan[];
  iwDev?: string;
  listeningSockets?: string;
}
