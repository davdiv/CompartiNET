// Note: don't use Record<A,B> in this file as it is not supported by typescript-json-schema

export type NetnsIno = number;

export interface NetworkModel {
  // The default namespace has an empty string "" key
  namedNetns: { [name: string]: NetnsIno };
  netnsByIno: { [ino: NetnsIno]: NamespaceModel };
}

export interface ListeningSocket {
  protocol: "udp4" | "udp6" | "tcp4" | "tcp6";
  host: string;
  port: number;
  zone?: string;
  serviceKey?: string;
}

export interface NamespaceModel {
  names: string[];
  interfaces: { [name: string]: InterfaceModel };
  routes: RouteModel[];
  listeningSockets: ListeningSocket[];
}

export interface IpAddressModel {
  family: "ipv4" | "ipv6";
  address: string;
  prefixLength: number;
}

export interface BridgeMemberVlanModel {
  vlanId: number;
  untagged: boolean;
}

export interface BridgeMemberModel {
  bridge: string;
  vlans: BridgeMemberVlanModel[];
  pvid?: number;
}

export interface InterfaceModelBase {
  up: boolean;
  addresses: IpAddressModel[];
  altnames: string[];
  mtu?: number;
  /**
   * @pattern ([0-9a-fA-F]{2}:){5}([0-9a-fA-F]{2})
   */
  macAddress?: string;
  netnsImmutable?: boolean;
  bridgeMember?: BridgeMemberModel;
}

export interface InterfaceModelUnknown extends InterfaceModelBase {
  type: "unknown";
}

export interface InterfaceModelLoopback extends InterfaceModelBase {
  type: "loopback";
}

export interface InterfaceModelHardware extends InterfaceModelBase {
  type: "hardware";
  hardwareBus?: string;
  hardwareDevice?: string;
  phy?: string;
}

export interface InterfaceModelBridge extends InterfaceModelBase {
  type: "bridge";
  vlanFiltering: boolean;
  stp: boolean;
  self: Omit<BridgeMemberModel, "bridge">;
}

export interface InterfaceModelVeth extends InterfaceModelBase {
  type: "veth";
  peerNetns: NetnsIno;
  peerIface: string;
}

export interface WireguardConfig {
  /**
   * @pattern [A-Za-z0-9+/=]+
   */
  privateKey?: string;
  listenPort?: number;
  fwMark?: number;
  peers: WireguardPeer[];
}

export interface WireguardPeer {
  /**
   * @pattern [A-Za-z0-9+/=]+
   */
  publicKey: string;
  /**
   * @pattern [A-Za-z0-9+/=]+
   */
  presharedKey?: string;
  endpoint?: string;
  /**
   * @minItems 1
   */
  allowedIPs: IpAddressModel[];
  persistentKeepalive?: number;
}

export interface InterfaceModelWireguard extends InterfaceModelBase {
  type: "wireguard";
  /*
   * birthNetns is tracked because it is the netns from which Wireguard sends and receives encrypted packets.
   * Note that the configuration of the interface must be done in the current netns of the interface, not the birthNetns
   */
  birthNetns?: NetnsIno;
  config: WireguardConfig;
}

export interface InterfaceModelAltname {
  type: "altname";
  iface: string;
}

export type RealInterfaceModel = InterfaceModelUnknown | InterfaceModelLoopback | InterfaceModelHardware | InterfaceModelBridge | InterfaceModelVeth | InterfaceModelWireguard;
export type InterfaceModel = RealInterfaceModel | InterfaceModelAltname;

export interface RouteModel extends IpAddressModel {
  iface: string;
  gateway?: string;
  metric?: number;
  onlink?: boolean;
}

export interface InterfaceLink {
  netns: NetnsIno;
  iface: string;
}
